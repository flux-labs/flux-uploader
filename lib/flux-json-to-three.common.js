'use strict';

var __commonjs_global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
/**
 * The VectorManager class. It is an ObjectPool
 * for three js vectors. When the vectors are done
 * being used, they should be cleared
 *
 * @class VectorManager
 */
function VectorManager () {
    this._vectorData = [];
    this._vectorCount = 0;
}



/**
 * Allocate a new vector with new or existing object.
 * The returned vector may have junk in its values
 *
 * @method alloc
 *
 * @return { THREE.Vector3 } The vector
 */
VectorManager.prototype.alloc = function alloc () {
    var result;

    if ( this._vectorCount < this._vectorData.length ) result = this._vectorData[ this._vectorCount ];
    else {
        result = new THREE.Vector3();
        this._vectorData.push( result );
    }

    this._vectorCount += 1;

    return result;
};



/**
 * Deallocate all vectors and begin reallocating from the pool
 *
 * @method clear
 * @return { VectorManager } this
 */
VectorManager.prototype.clear = function clear () {
    this._vectorCount = 0;
    return this;
};



/**
 * Allocate a new vector with the same values as an existing one
 *
 * @method clone
 * @return { THREE.Vector3 } The newly allocated vector
 *
 * @param { THREE.Vector3 } v The vector to copy
 */
VectorManager.prototype.clone = function clone ( v ) {
    return this.alloc().copy( v );
};


/**
 * Create and allocate a vector from an array
 *
 * @method convert
 * @return { THREE.Vector3 } The newly allocated vector
 *
 * @param  {[Number]} arr Array of 3 numeric values
 */
VectorManager.prototype.convert = function clone ( arr ) {
    return this.alloc().set( arr[0], arr[1], arr[2] );
};

var HALF_PI = Math.PI * 0.5;
var TOLERANCE = 0.000001;
var DEFAULT_ROTATION = new THREE.Vector3( HALF_PI, HALF_PI, 0 );
var PLANE_DEFAULTS = {
        WIDTH: 10000,
        HEIGHT: 10000,
        WIDTH_SEGMENTS: 100,
        HEIGHT_SEGMENTS: 100
    };
var CIRCLE_RES = 32;
var DEG_2_RAD = Math.PI / 180;
var MATERIAL_TYPES = {
    PHONG: 0,
    POINT: 1,
    LINE: 2
};
//----NURBS
var NURBS_CURVE_QUALITY = 2.5;
var NURBS_SURFACE_QUALITY = 2.5;
// A NURBS surface with angles between the faces of its control hull below
// this threshold will be considered flat
var degreesFlatLimit = 1.0;
var NURBS_FLAT_LIMIT = degreesFlatLimit/180.0;

var LEGACY_NAMES_MAP = {
    'point-2d': 'point',
    'polygon-set': 'polygonSet'
};
// These entities are not official Flux Entities, but can be rendered
var NON_STANDARD_ENTITIES = 'stl obj text';

// For a face compare the angle between it's normals and those of
// it's neighbors. If all the angles are smaller than the limit,
// the face will be rendered smooth.
// Range is from 0 (more faceted) to 180 (more smooth)
var degreesSmoothLimit = 45;
var NORMALS_SMOOTH_LIMIT = Math.cos(degreesSmoothLimit * DEG_2_RAD);

var DEFAULT_POINT_COLOR = [0.5,0.5,0.8];
var DEFAULT_LINE_COLOR =  [0.5,0.5,0.8];
var DEFAULT_PHONG_COLOR = [  1,  1,  1];

var DEFAULT_MATERIAL_PROPERTIES = {
    // color is per point
    phong: {
        opacity: 1.0,
        //roughness: 1.0,  TODO this has to be translated to specular as in flux-materialUtil.html
        wireframe: false,
        side: THREE.DoubleSide
    },
    point: {
        size: 5.0,
        sizeAttenuation: true
    },
    line: {
        linewidth: 1.0
    }
};

var DEFAULT_UNITS = 'meters';

function FluxGeometryError(message) {
    this.name = 'FluxGeometryError';
    this.message = message || 'Invalid or degenerate geometry specified.';
    this.stack = (new Error()).stack;
}
FluxGeometryError.prototype = Object.create(Error.prototype);
FluxGeometryError.prototype.constructor = FluxGeometryError;

/*
 * helpers
 */

var vec = new VectorManager(); // an ObjectPool for managing Three.js vectors

/**
 * Creates a linear mesh from parasolid data and a material
 *
 * @function line
 *
 * @return { THREE.Mesh } The linear mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the mesh
 */
function line ( data, material ) {
    var geometry = new THREE.BufferGeometry(),
        vertices = new Float32Array( data.start.concat( data.end ) );

    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

    return new THREE.Line( geometry, material );
}

/**
 * Creates a mesh as a set of lines from parasolid data and a material
 *
 * @function polyline
 *
 * @return { THREE.Mesh } The mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the mesh

 */
function polyline ( data, material ) {

    var geometry = new THREE.Geometry(),
        point;

    for ( var i = 0, len = data.points.length ; i < len ; i++ ) {
        point = data.points[ i ];
        geometry.vertices.push(
            new THREE.Vector3( point[ 0 ], point[ 1 ], point[ 2 ] )
        );
    }

    return new THREE.Line( geometry, material );
}

/**
 * Creates a circular line from parasolid data and a material
 *
 * @function circle
 *
 * @return { THREE.Line } The circular line
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the mesh
 */
function circle ( data, material ) {
    var r = data.radius;
    var numPoints = CIRCLE_RES;
    var vertices = new Float32Array( ( numPoints  ) * 3 );
    var i, x, y, t, dt;
    t = 0;
    dt = 2 * Math.PI / (numPoints-1);
    for (i = 0; i < vertices.length; i += 3, t += dt) {
        x = r * Math.cos(t);
        y = r * Math.sin(t);
        vertices[i  ] = x;
        vertices[i+1] = y;
        vertices[i+2] = 0;
    }

    // Create geometry and material
    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

    return new THREE.Line(geometry, material);
}

/**
 * Creates a curve mesh from parasolid data and a material
 *
 * @function curve
 *
 * @return { THREE.Mesh } The curve mesh
 * @throws FluxGeometryError if nurbs are invalid
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the mesh
 */
function curve ( data, material ) {
    if ( !data.knots || !data.controlPoints )
        throw new FluxGeometryError( 'Curve is missing knots or control points.');

    var nurbsControlPoints = _createControlPoints( data ),
        geometry = new THREE.Geometry();

    if ( data.knots.length !== nurbsControlPoints.length + data.degree + 1 )
        throw new FluxGeometryError( 'Number of uKnots in a NURBS curve should equal degree + N + 1, where N is the number ' +
                         'of control points' );

    var numPoints = Math.max(Math.floor(nurbsControlPoints.length * data.degree * NURBS_CURVE_QUALITY),
        nurbsControlPoints.length-1);
    geometry.vertices = data.degree > 1 ?
        new THREE.NURBSCurve( data.degree, data.knots, nurbsControlPoints ).getPoints( numPoints ) :
        nurbsControlPoints;

    return new THREE.Line( geometry, material );
}

/**
 * Helper to create a set of control points from parasolid data
 *
 * @function _createControlPoints
 * @private
 *
 * @return { Array<Three.Vector4> } The array of vector 4s
 *
 * @param { Object }           data     Parasolid data
 */
function _createControlPoints ( data ) {
    var controlPoints = data.controlPoints,
        result = [],
        i = 0,
        weights = data.weights,
        len = controlPoints.length,
        currentControlPoint;

    for ( ; i < len ; i++ ) {
        currentControlPoint = controlPoints[ i ];
        result.push(
            new THREE.Vector4(
                currentControlPoint[ 0 ],
                currentControlPoint[ 1 ],
                currentControlPoint[ 2 ],
                weights ? weights[ i ] : 1
            )
        );
    }

    return result;
}

/**
 * Creates a arc mesh from parasolid data and a material
 *
 * @function arc
 *
 * @return { THREE.Mesh } The arc mesh
 *
 * @throws FluxGeometryError if the data doesn't have a start, middle, or end property
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the mesh

 */
function arc ( data, material ) {
    var geometry,
        vertices;

    if (!data.start || !data.middle || !data.end) {
        throw new FluxGeometryError('Can not create arc due to incomplete definition.');
    }

    // Initialize vectors
    var a = vec.alloc().set(data.start[0], data.start[1], data.start[2]);
    var b = vec.alloc().set(data.middle[0], data.middle[1], data.middle[2]);
    var c = vec.alloc().set(data.end[0], data.end[1], data.end[2]);

    // Compute line segments
    var ab = vec.clone(b).sub(a);
    var bc = vec.clone(c).sub(b);

    // check for degenerate inputs
    if (ab.length() < TOLERANCE || bc.length() < TOLERANCE ||
            1.0 - Math.abs(vec.clone(ab).normalize().dot(vec.clone(bc).normalize())) < TOLERANCE) {
        // when the arc is degenerate, just draw line segments
        vertices = new Float32Array( 9 );
        _setVecInArray(vertices, 0, a);
        _setVecInArray(vertices, 3, b);
        _setVecInArray(vertices, 6, c);
    }
    else { // arc is ok
        var abMid =  vec.alloc();
        _computeMidpoint(a, b, abMid);
        var bcMid =  vec.alloc();
        _computeMidpoint(b, c, bcMid);

        // compute perpendicular bisectors
        var up = vec.alloc().crossVectors(ab,bc).normalize();
        var abPerp = vec.alloc().crossVectors(ab,up).normalize();
        var bcPerp = vec.alloc().crossVectors(up,bc).normalize();

        // calculate intersection
        var center =  vec.alloc();
        _intersectLines(abMid, bcMid, abPerp, bcPerp, center);

        // determine line segment points
        vertices = _tessellateArc(a, c, ab, bc, center, up);
    }

    if (vertices.length <= 0) {
        throw new FluxGeometryError( 'Arc has no vertices');
    }

    // Create geometry and material
    geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

    vec.clear();

    return new THREE.Line(geometry, material);
}

/**
 * Computes the midpoint as the center of segment ab
 *
 * @function _computeMidpoint
 * @private
 *
 * @param { THREE.Vector3 } a        The first point
 * @param { THREE.Vector3 } b        The second point
 * @param { THREE.Vector3 } midPoint The midpoint
 */
function _computeMidpoint ( a, b, midPoint ) {
    midPoint.copy( b );
    midPoint.sub( a );
    midPoint.multiplyScalar( 0.5 );
    midPoint.add( a );
}

/**
 * Caclulate an appropriate number of points along a given arc
 *
 * @function _tessellateArc
 * @private
 *
 * @return { Float32Array } List of coordinates
 *
 * @param { THREE.Vector3 } a First point along the arc
 * @param { THREE.Vector3 } c Third point on arc
 * @param { THREE.Vector3 } ab Segement from a to b
 * @param { THREE.Vector3 } bc Segement from b to c
 * @param { THREE.Vector3 } center Center of arc
 * @param { THREE.Vector3 } up Normal to plane containing the arc
 */
function _tessellateArc ( a, c, ab, bc, center, up ) {
    // interpolate points on the curve and populate geometry
    var relA = vec.clone( a ).sub( center ),
        relC = vec.clone( c ).sub( center ),
        angle = relA.angleTo( relC ),
        angleABC = Math.PI - ab.angleTo( bc );

    if ( angleABC < Math.PI * 0.5 ) {
        angle = 2 * Math.PI - angle;
    }

    var numSections = Math.ceil( angle * ( 42 / ( 2 * Math.PI ) ) ),
        dTheta = angle / numSections,
        vertices = new Float32Array( ( numSections + 1  ) * 3 );

    for ( var i = 0 ; i <= numSections ; i++ ) {
        vertices[ i * 3 ] = relA.x + center.x;
        vertices[ i * 3 + 1 ] = relA.y + center.y;
        vertices[ i * 3 + 2 ] = relA.z + center.z;
        relA.applyAxisAngle( up, dTheta );
    }

    return vertices;
}

/**
 * Compute the intersection of two lines in 3D.
 * @Precondition The lines are not parallel, there is exactly 1 intersection.
 *
 * @function _intersectLines
 * @private
 *
 * @param  {THREE.Vector3} p0 Point on the first line
 * @param  {THREE.Vector3} p1 Point on the second line
 * @param  {THREE.Vector3} d0 Direciton of first line
 * @param  {THREE.Vector3} d1 Direction of second line
 * @param {THREE.Vector3} intersect Return parameter for intersection point
 */
function _intersectLines (p0, p1, d0, d1, intersect) {
    // Mathematically this is solved by equating the parametric equations
    // of the two lines and solving for t at the time of their intersection
    // Equivalent equations can be made by substituting each component x, y and z
    // so we try each permutation in case one of them runs into divide by zero.
    // Each pair of elements in this array is one case to calculate.
    var cases = ['x', 'y', 'x', 'z', 'y', 'x',
        'y', 'z', 'z', 'x', 'z', 'y' ];
    var t0;
    var i = 0;
    var x;
    var y;
    while(!isFinite(t0) && i < cases.length) {
        x = cases[i];
        y = cases[i+1];
        // compute t from the formula
        t0 = (p0[x] - p1[x] - (p0[y] * d1[x]) / d1[y] + (p1[y] * d1[x]) / d1[y] ) /
            ( (d0[y] * d1[x]) / d1[y] - d0[x]);
            i += 2;
    }
    // calculate the intersection as a linear combination of the point and direction
    intersect.copy(d0).multiplyScalar(t0).add(p0);
}

/**
 * Add each element of a vector to an array
 * @param  {Array} arr Array of coordinates
 * @param  {Number} offset Index to start in array
 * @param  {THREE.Vector3} vec Vector of 3 values
 */
function _setVecInArray (arr, offset, vec) {
    arr[offset] = vec.x;
    arr[offset+1] = vec.y;
    arr[offset+2] = vec.z;
}

/**
 * Creates a rectangular line from parasolid data and a material
 *
 * @function rectangle
 *
 * @return { THREE.Line } The rectangular line
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the mesh
 */
function rectangle ( data, material ) {
    var dx = data.dimensions[0] * 0.5;
    var dy = data.dimensions[1] * 0.5;

    var numPoints = 5;
    var vertices = new Float32Array( ( numPoints  ) * 3 );
    vertices[0] = -dx;
    vertices[1] = dy;
    vertices[2] = 0;

    vertices[3] = dx;
    vertices[4] = dy;
    vertices[5] = 0;

    vertices[6] = dx;
    vertices[7] = -dy;
    vertices[8] = 0;

    vertices[9] = -dx;
    vertices[10] = -dy;
    vertices[11] = 0;

    vertices[12] = -dx;
    vertices[13] = dy;
    vertices[14] = 0;

    // Create geometry and material
    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

    return new THREE.Line(geometry, material);
}

/**
 * Creates a elliptic curve
 *
 * @function ellipse
 *
 * @return { THREE.Line } The shape
 *
 * @param { Object }           data     Parasolid entity data
 * @param { THREE.Material } material The material to give the mesh
 */
function ellipse ( data, material ) {
    // Origin and axis are ignored here and applied later in cleanupMesh
    var curve = new THREE.EllipseCurve(
        0,  0,                              // center x, center y
        data.majorRadius, data.minorRadius, // xRadius, yRadius
        0,  2 * Math.PI,                    // aStartAngle, aEndAngle
        false,                              // aClockwise
        0                                   // aRotation
    );

    var path = new THREE.Path( curve.getPoints( CIRCLE_RES ) );
    var geometry = path.createPointsGeometry( CIRCLE_RES );
    return new THREE.Line( geometry, material );
}

/**
 * Creates a vector THREE.Mesh from parasolid data and a material
 *
 * @function vector
 *
 * @return { THREE.Mesh } The vector THREE.Mesh
 *
 * @throws FluxGeometryError if vector has zero length
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function vector ( data, material ) {
    var dir = new THREE.Vector3( data.coords[ 0 ], data.coords[ 1 ], data.coords[ 2 ] );

    if ( dir.length() > 0 ) dir.normalize();
    else throw new FluxGeometryError( 'Vector primitive has length zero' );

    // The half width of the arrow
    var d = 0.03;
    // The length of the arrow
    var l = 1;
    // This is the coordinate of the base of the head
    var c = 0.85;
    var verticesArr = [
        // Main axis
        0,0,0,
        0,0,l,
        // Cap the head
        d,d,c,
        d,-d,c,
        0,0,1,
        -d,d,c,
        -d,-d,c,
        0,0,l,
        d,-d,c,
        -d,-d,c,
        0,0,l,
        d,d,c,
        -d,d,c
    ];

    var vertices = new Float32Array( verticesArr );
    // Create geometry and material
    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    var mesh = new THREE.Line(geometry, material);
    mesh.lookAt(dir);
    return mesh;
}

var wirePrimitives = Object.freeze({
    line: line,
    polyline: polyline,
    circle: circle,
    curve: curve,
    arc: arc,
    rectangle: rectangle,
    ellipse: ellipse,
    vector: vector
});

/*
 * helpers
 */

var vec$1 = new VectorManager(); // an ObjectPool for managing Three.js vectors

/**
 * Convert a flux json polygon to an object with THREE Vector3 coordinates
 *
 * @function _polygonToThree
 *
 * @return {Object}         The new converted polygon
 *
 * @param  {Object} polygon The Flux JSON polygon to convert
 */
function _polygonToThree(polygon) {
    var polygonThree = {boundary: [], holes: []};
    _pointArrayToThree(polygonThree.boundary, polygon.boundary);
    if (!polygon.holes) return polygonThree;
    for (var i=0, len=polygon.holes.length; i<len; i++) {
        var holeThree = [];
        polygonThree.holes.push(holeThree);
        _pointArrayToThree(holeThree, polygon.holes[i]);
    }
    return polygonThree;
}

/**
 * Convert an array of triples of numbers into an array of THREE.Vector3
 * @param  {Array.<THREE.Vector3>} pointsThree Destination
 * @param  {Array.<[Number,Number,Number]>} pointsArray Source
 */
function _pointArrayToThree(pointsThree, pointsArray) {
    for (var i=0, len=pointsArray.length; i<len; i++) {
        pointsThree.push(vec$1.convert(pointsArray[i]));
    }
}

/**
 * Creates a THREE.Mesh as a set of polygons from parasolid data and a material
 *
 * @function polygonSet
 *
 * @return { THREE.Mesh } The THREE.Mesh
 *
 *  @throws FluxGeometryError if polygon is non planar
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function polygonSet ( data, material ) {

    // TODO check for degeneracy (such as collocated points)
    // TODO check for winding order (holes should match boundary)
    var p = vec$1.alloc();
    var n = vec$1.alloc();
    var u = vec$1.alloc();
    var v = vec$1.alloc();

    // Loop over all shapes and holes
    for (var i=0, len=data.polygons.length; i<len; i++) {

        var polygon = _polygonToThree(data.polygons[i]);

        _computePointBasis(p, n, u, v, polygon.boundary);

        var p0 = vec$1.clone(polygon.boundary[0]);

        // Polygon must be planar
        if (!_isPlanarPolygon(polygon, n, p0)) {
            throw new FluxGeometryError('Non planar polygon in polygonSet');
        }

        //TODO convert the remaining code to use polygon
        var polygon2d = { boundary: [], holes: []};
        _reduceCoordinates(polygon2d.boundary, polygon.boundary, u, v, p0);
        if (polygon.holes) {
            for (var j=0, jLen = polygon.holes.length; j<jLen; j++) {
                polygon2d.holes.push([]);
                _reduceCoordinates(polygon2d.holes[j], polygon.holes[j], u, v, p0);
            }
        }
        // Build the triangulated shape
        var geometry = _makeShapeGeometry(polygon2d);

        _restoreCoordinates(geometry, p, u, v);
    }

    return new THREE.Mesh( geometry, material );
}

/**
 * Check if an array of points is on a given plane
 * @param  {Array.<THREE.Vector3>}  pointsThree List of point objects
 * @param  {THREE.Vector3}  n       Normal vector
 * @param  {THREE.Vector3}  p0      Point on the plane
 * @return {Boolean}                True when the points are on the plane
 */
function _isPlanarArray (pointsThree, n, p0) {
    var pointRel = vec$1.alloc();
    for (var i=0, len=pointsThree.length; i<len; i++) {
        pointRel.copy(pointsThree[i]).sub(p0);
        if (Math.abs(pointRel.dot(n))>TOLERANCE) {
            return false;
        }
    }
    return true;
}

/**
 * Check if a polygon is flat.
 * @param  {Object}  polyThree Polygon with points as objects
 * @param  {THREE.Vector3}  n       Normal vector
 * @param  {THREE.Vector3}  p0      Point on the plane
 * @return {Boolean}           True if the polygon and it's holes are planar
 */
function _isPlanarPolygon(polyThree, n, p0) {
    var planar = _isPlanarArray(polyThree.boundary, n, p0);
    if (!polyThree.holes) return planar;
    for (var i=0, len=polyThree.holes.length; i<len && planar; i++) {
        if (!_isPlanarArray(polyThree.holes[i], n, p0)) {
            planar = false;
        }
    }
    return planar;
}

/**
 * Convert planar three dimensional points to a two dimensional coordinate system.
 * @param  {[]} destPoints Array to hold output
 * @param  {[]} srcPoints  Source array of points
 * @param  {THREE.Vector3} u          Coordinate basis first direction
 * @param  {THREE.Vector3} v          Coordinate basis second direction
 * @param  {THREE.Vector3} p0         Point on the polygon
 */
function _reduceCoordinates(destPoints, srcPoints, u, v, p0) {
    var p = vec$1.alloc();
    var s, t;
    for (var i=0, len=srcPoints.length; i<len; i++) {
        p.copy(srcPoints[i]).sub(p0);

        s = p.dot(u);
        t = p.dot(v);
        destPoints.push(vec$1.alloc().set(s, t, 0));
    }
}

/**
 * Convert 2D coordinates back to world space 3D.
 * This modifies the vertex positions in place.
 * @param  {THREE.Geometry} geometry The geometry to transform
 * @param  {[type]} p        The origin point on the polygon
 * @param  {[type]} u        The first basis direction.
 * @param  {[type]} v        The second basis direction.
 */
function _restoreCoordinates(geometry, p, u, v) {
    var uTmp = vec$1.alloc();
    var vTmp = vec$1.alloc();
    for ( var i = 0, len = geometry.vertices.length ; i < len ; i++ ) {

        var vert = geometry.vertices[i];
        var s = vert.x;
        var t = vert.y;
        uTmp.copy(u);
        vTmp.copy(v);

        vert.copy(p);
        vert.add(uTmp.multiplyScalar(s));
        vert.add(vTmp.multiplyScalar(t));
    }
    geometry.verticesNeedUpdate = true;
}

/**
 * Compute a coordinate system for the given set of points
 * @param  {THREE.Vector3} p      Return vector for a point on the polygon
 * @param  {THREE.Vector3} n      Return vector for the polygon normal
 * @param  {THREE.Vector3} u      Return vector for the polygon basis first direction
 * @param  {THREE.Vector3} v      Return vector for the polygon basis second direction
 * @param  {Array.<Array.<Number>>} points The points defining the polygon
 */
function _computePointBasis(p, n, u, v, points) {
    n.set(0,0,1);
    if (points.length < 3) {
        return;
    }
    p.copy(points[0]);

    //TODO check memory allocation (would be large for many polygons)
    var v0 = vec$1.alloc().copy(points[0]);
    u.copy(points[1]);
    v.copy(points[points.length-1]);

    u.sub(v0).normalize();
    v.sub(v0).normalize();

    n.crossVectors(u, v).normalize();
    v.crossVectors(n, u).normalize();
}

/**
 * Make THREE.geometry from a flux JSON polygon object.
 * The polygon is like a flux JSON object, but actually
 * the points have all been converted from arrays to Vector3 objects.
 * @param  {Object} polygon Flux JSON polygon
 * @return {THREE.Geometry}         The renderable geometry.
 */
function _makeShapeGeometry(polygon) {

    var shape = _makeShape( polygon.boundary );

    _makeShapeHoles(shape, polygon.holes);

    var geometry = new THREE.ShapeGeometry( shape );

    geometry.computeBoundingSphere();
    geometry.computeFaceNormals();

    return geometry;
}

/**
 * Process each hole as a shape to convert it.
 * @param  {Object} shape The shape to contain the converted holes
 * @param  {Object} holes The list of holes
 */
function _makeShapeHoles(shape, holes) {
    for (var i=0, len=holes.length; i<len; i++) {
        var hole = _makeShape( holes[i] );
        shape.holes.push(hole);
    }
}

/**
 * Create a shape object from a list of points
 * @param  {Array.<THREE.Vector3>} boundary The points to process
 * @return {THREE.Shape}          Shape object representing the polygon
 */
function _makeShape(boundary) {

    var shape = new THREE.Shape();
    for ( var i = 0, len = boundary.length ; i < len ; i++ ) {
        shape.moveTo( boundary[i].x, boundary[i].y );
    }
    return shape;
}

/**
 * Calculate the maximum curvature across a surface geometry
 * The curvature is computed for each face compared to it's neighbors
 * and then the maximum angle is the result.
 * @param {THREE.Geometry} geom The surface
 * @returns {number} The normalized curvature between 0 and 1
 * @private
 */
function _calcMaxCurvature(geom) {

    var v, vl, f, fl, face, vertexToFaces;
    // List of all the co-incident faces, indexed by [v][f]
    // Stores a pair of a face index and a vertex index on a face
    vertexToFaces = [];

    for ( v = 0, vl = geom.vertices.length; v < vl; v ++ ) {
        vertexToFaces[v] = [];
    }

    // Add the face normals as vertex normals
    for ( f = 0, fl = geom.faces.length; f < fl; f ++ ) {
        face = geom.faces[ f ];
        vertexToFaces[face.a].push([f,0]);
        vertexToFaces[face.b].push([f,1]);
        vertexToFaces[face.c].push([f,2]);
    }
    var invPi = 1.0 / Math.PI;
    var maxCurvature = 0;
    // Convert triangle index scheme from a b c to 1 2 3
    var iToAbc = ['a', 'b', 'c'];
    // For each face
    for ( f = 0, fl = geom.faces.length; f < fl; f ++ ) {
        face = geom.faces[ f ];
        // For each vertex on the face
        for (var i=0; i<3; i++) {
            var faceAbc = face[iToAbc[i]];
            // For each face neighboring the vertex
            for ( v = 0, vl = vertexToFaces[faceAbc].length; v < vl; v ++ ) {
                // look up normal by face, and vertex and add if within threshold
                var faceIndex = vertexToFaces[faceAbc][v][0];
                var curvature = invPi * face.normal.angleTo(geom.faces[faceIndex].normal);
                if (curvature > maxCurvature) {
                    maxCurvature = curvature;
                }
            }
        }
    }

    return maxCurvature;
}
/**
 * Creates a surface THREE.Mesh from parasolid data and a material
 *
 * @function surface
 *
 * @return { THREE.Mesh } The THREE.Mesh
 *
 * @throws FluxGeometryError if nurbs definition is invalid
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh

 */
function surface ( data, material ) {
    if (!data || !data.controlPoints) {
        throw new FluxGeometryError('Data must exist and have controlPoints');
    }
    var j, len2, controlPointRow, point, arr;
    var nsControlPoints = [];
    var controlPoints = data.controlPoints;
    var i = 0;
    var len = controlPoints.length;

    // For each control point
    for ( ; i < len ; i++ ) {
        arr = [];
        nsControlPoints.push( arr );
        controlPointRow = controlPoints[ i ];
        for ( j = 0, len2 = controlPointRow.length ; j < len2 ; j++ ) {
            point = controlPointRow[ j ];
            arr.push(
                new THREE.Vector4(
                    point[ 0 ], point[ 1 ], point[ 2 ],
                    data.weights ? data.weights[ j * len + i ] : 1
                )
            );
        }
    }

    if ( data.uKnots.length !== nsControlPoints[ 0 ].length + data.uDegree + 1 )
        throw new FluxGeometryError( 'Number of uKnots in a NURBS surface should equal uDegree + N + 1' +
                         ', where N is the number of control points along U direction' );

    if ( data.vKnots.length !== nsControlPoints.length + data.vDegree + 1 )
        throw new FluxGeometryError( 'Number of vKnots in a NURBS surface should equal vDegree + N + 1' +
                         ', where N is the number of control points along V direction' );

    var nurbsSurface = new THREE.NURBSSurface( data.vDegree, data.uDegree, data.vKnots, data.uKnots, nsControlPoints );
    var getPointFunction = nurbsSurface.getPoint.bind(nurbsSurface);

    // Tessellate the NURBS at the minimum level to get the polygon control hull
    var minSlices = nsControlPoints.length-1;
    var minStacks = nsControlPoints[0].length-1;
    var geometry = new THREE.ParametricGeometry(getPointFunction, minSlices, minStacks);
    geometry.computeFaceNormals();

    // Determine the appropriate resolution for the surface based on the curvature of the control hull
    var curvature = _calcMaxCurvature(geometry);
    var factor = curvature * NURBS_SURFACE_QUALITY;

    // Interpolate between flat and maximum detail, never less than the nurbs control hull
    var slices = Math.max(Math.floor(data.vDegree * nsControlPoints.length * factor), minSlices);
    var stacks = Math.max(Math.floor(data.uDegree * nsControlPoints[0].length * factor), minStacks);

    // Exception for totally flat surfaces, then render as a single quad
    if (curvature < NURBS_FLAT_LIMIT) {
        slices = 1;
        stacks = 1;
    }

    if (slices !== minSlices || stacks !== minStacks) {
        // Build the final geometry using the dynamic resolution
        geometry.dispose();
        geometry = new THREE.ParametricGeometry(getPointFunction, slices, stacks);
        geometry.computeFaceNormals();
    }

    return new THREE.Mesh( geometry, material );
}


var sheetPrimitives = Object.freeze({
    polygonSet: polygonSet,
    surface: surface
});

/**
 * Moves a geometry by a vector
 *
 * @function moveGeometry
 *
 * @param { THREEJS.OBJECT3D } object The object to move
 * @param { THREE.Vector3 } vector The vector to move the object by
 */
function moveGeometry ( object, vector ) {
    object.position.copy( vector );
    object.updateMatrix();
    object.geometry.applyMatrix( object.matrix );
    object.position.set( 0, 0, 0 );
}

/**
 * Rotates a geometry by a vector
 *
 * @function rotateGeometry
 *
 * @param { THREEJS.OBJECT3D } object The object to rotate
 * @param { THREE.Vector3 }  vector The vector to rotate by in Euler Angles
 */
function rotateGeometry ( object, vector ) {
    object.rotation.set( vector.x, vector.y, vector.z );
    object.updateMatrix();
    object.geometry.applyMatrix( object.matrix );
    object.rotation.set( 0, 0, 0 );
}

/**
 * Extract the semi angle property from a data object.
 * Used to determine cone shape. Data is expected to have a
 * semiAngle property set in degrees.
 *
 * @param  {Object} data The data describing a cone.
 *
 * @function getSemiAngle
 *
 * @throws FluxGeometryError if property is missing or out of bounds
 *
 * @return {Number}      The semi angle in radians.
 */
function getSemiAngle(data) {
    var semiAngle;
    if (data.semiAngle) {
        semiAngle = data.semiAngle;
    } else {
        if (data['semi-angle']) {
            semiAngle = data['semi-angle'];
        } else {
            throw new FluxGeometryError('Cone must specify semiAngle parameter.');
        }
    }
    if (data.semiAngle <= 0 || data.semiAngle >= 90) {
        throw new FluxGeometryError('Cone semiAngle must be between 0 and 90 degrees exclusive.');
    }
    return DEG_2_RAD * semiAngle;
}
/**
 * Creates a cone THREE.Mesh from parasolid data and a material.
 *
 * @function cone
 *
 * @return { THREE.Mesh } The cone THREE.Mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function cone ( data, material ) {
    var geometry, mesh;
    var semiAngle = getSemiAngle(data);
    var topRadius = data.height * Math.tan(semiAngle);
    geometry = new THREE.CylinderGeometry( topRadius+data.radius, data.radius, data.height, CIRCLE_RES );
    mesh = new THREE.Mesh( geometry, material );
    moveGeometry( mesh, new THREE.Vector3( 0, data.height * 0.5, 0 ) );
    rotateGeometry( mesh, DEFAULT_ROTATION );

    return mesh;
}

/**
 * Creates a cylindrical THREE.Mesh from parasolid data and a material
 *
 * @function cylinder
 *
 * @return { THREE.Mesh } The cylindrical THREE.Mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function cylinder ( data, material ) {
    var geometry, mesh;

    geometry = new THREE.CylinderGeometry( data.radius, data.radius, data.height, CIRCLE_RES );
    mesh = new THREE.Mesh( geometry, material );
    moveGeometry( mesh, new THREE.Vector3( 0, data.height * 0.5, 0 ) );
    rotateGeometry( mesh, DEFAULT_ROTATION );

    return mesh;
}

/**
 * Creates a spherical THREE.Mesh from parasolid data and a material
 *
 * @function sphere
 *
 * @return { THREE.Mesh } The spherical THREE.Mesh
 *
 * @throws FluxGeometryError if sphere is missing radius
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function sphere ( data, material ) {
    var geometry, mesh;

    if (!data.radius) {
        throw new FluxGeometryError('Sphere is missing radius.');
    }

    geometry = new THREE.SphereBufferGeometry( data.radius, 12, 8 );
    mesh = new THREE.Mesh( geometry, material );
    rotateGeometry( mesh, DEFAULT_ROTATION );

    return mesh;
}

/**
 * Creates a toroidal THREE.Mesh from parasolid data and a material
 *
 * @function torus
 *
 * @return { THREE.Mesh } The toroidal THREE.Mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function torus ( data, material ) {
    var majorRadius = data.majorRadius || data.major_radius;
    var minorRadius = data.minorRadius || data.minor_radius;
    var geometry = new THREE.TorusGeometry( majorRadius, minorRadius, 24, 24 );
    return new THREE.Mesh( geometry, material );
}

/**
 * Creates a box THREE.Mesh from parasolid data and a material
 *
 * @function block
 *
 * @return { THREE.Mesh } The box THREE.Mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function block ( data, material ) {
    var geometry = new THREE.BoxGeometry( data.dimensions[ 0 ], data.dimensions[ 1 ], data.dimensions[ 2 ] );
    return new THREE.Mesh( geometry, material );
}

/**
 * Compute optimal normals from face and vertex normals
 *
 * @function computeCuspNormals
 *
 * @param  {Three.Geometry} geom  The geometry in need of normals
 * @param  {Number} thresh        Threshold for switching to vertex normals
 */
function computeCuspNormals ( geom, thresh ) {
    var v, vl, f, fl, face, vertexToFaces, faceNormals;
    // List of all the co-incident faces, indexed by [v][f]
    // Stores a pair of a face index and a vertex index on a face
    vertexToFaces = [];

    for ( v = 0, vl = geom.vertices.length; v < vl; v ++ ) {
        vertexToFaces[v] = [];
    }

    faceNormals = [];
    // Add the face normals as vertex normals
    for ( f = 0, fl = geom.faces.length; f < fl; f ++ ) {
        face = geom.faces[ f ];
        faceNormals.push([]);
        faceNormals[f][0] = new THREE.Vector3();
        faceNormals[f][1] = new THREE.Vector3();
        faceNormals[f][2] = new THREE.Vector3();
        vertexToFaces[face.a].push([f,0]);
        vertexToFaces[face.b].push([f,1]);
        vertexToFaces[face.c].push([f,2]);
    }

    // Convert triangle index scheme from a b c to 1 2 3
    var iToAbc = ['a', 'b', 'c'];
    // For each face
    for ( f = 0, fl = geom.faces.length; f < fl; f ++ ) {
        face = geom.faces[ f ];
        // For each vertex on the face
        for (var i=0; i<3; i++) {
            var faceAbc = face[iToAbc[i]];
            // For each face neighboring the vertex
            for ( v = 0, vl = vertexToFaces[faceAbc].length; v < vl; v ++ ) {
                // look up normal by face, and vertex and add if within threshold
                var faceIndex = vertexToFaces[faceAbc][v][0];
                var fN = geom.faces[faceIndex].normal;
                if (face.normal.dot(fN) > thresh) {
                    faceNormals[faceIndex][vertexToFaces[faceAbc][v][1]].add(face.normal);
                }
            }
        }
    }

    // Normalize the normals to unit length
    for ( f = 0, fl = faceNormals.length; f < fl; f ++ ) {
        for (v=0;v<faceNormals[f].length;v++) {
            faceNormals[f][v].normalize();
        }
    }

    // Apply the normals to the faces
    for ( f = 0, fl = geom.faces.length; f < fl; f ++ ) {
        face = geom.faces[ f ];
        // Apply vertex normals if the face is not flat
        if (faceNormals[f][0].distanceToSquared(faceNormals[f][1]) > TOLERANCE ||
            faceNormals[f][1].distanceToSquared(faceNormals[f][2]) > TOLERANCE) {
            var vertexNormals = face.vertexNormals;
            vertexNormals[0] = faceNormals[f][0].clone();
            vertexNormals[1] = faceNormals[f][1].clone();
            vertexNormals[2] = faceNormals[f][2].clone();
        }
    }
}

/**
 * Creates a THREE.Mesh from parasolid data and a material
 *
 * @precondition The faces in the mesh must be triangles or convex planar polygons.
 * Also this assumes the faces are wound counter clockwise.
 *
 * @function THREE.Mesh
 *
 * @return {THREE.Mesh} The THREE.Mesh
 *
 * @param {Object}          data     Parasolid data
 * @param {THREE.Material}  material The material to give the THREE.Mesh

 */
function mesh (data, material) {
    var geometry = new THREE.Geometry(),
        face;

    for ( var i = 0, len = data.vertices.length ; i < len ; i++ ) {
        geometry.vertices.push(new THREE.Vector3(
            data.vertices[i][0],
            data.vertices[i][1],
            data.vertices[i][2])
        );
    }

    for ( i = 0, len = data.faces.length ; i < len ; i++ ) {
        face = data.faces[ i ];
        if ( face.length === 3 ) {
            geometry.faces.push(new THREE.Face3(face[0], face[1], face[2]));
        } else if ( face.length > 3 ) {
            for ( var j=0; j+2<face.length; j++) {
                geometry.faces.push(new THREE.Face3(face[0], face[j+1], face[j+2]));
            }
        }

    }

    geometry.computeBoundingSphere();
    geometry.computeFaceNormals();
    computeCuspNormals(geometry, NORMALS_SMOOTH_LIMIT);

    return new THREE.Mesh( geometry, material );
  }

// Singleton loader object
var objLoader = new THREE.OBJLoader();
/**
 * Convert stl data into geometry
 * @param {object} data The stl primitive
 * @param {THREE.material} material The material to use
 * @returns {THREE.Mesh} The mesh containing the geometry
 */
function obj (data) {
    return objLoader.parse(data.data);
}

// Singleton loader object
var stlLoader = new THREE.STLLoader();
/**
 * Convert stl data into geometry
 * @param {object} data The stl primitive
 * @param {THREE.material} material The material to use
 * @returns {THREE.Mesh} The mesh containing the geometry
 */
function stl (data, material) {
    var geometry = stlLoader.parseASCII(data.data);

    geometry.computeBoundingSphere();
    geometry.mergeVertices();
    geometry.computeFaceNormals();
    computeCuspNormals(geometry, NORMALS_SMOOTH_LIMIT);

    return new THREE.Mesh( geometry, material );
}

/**
 * Creates a planar THREE.Mesh from parasolid data and a material
 *
 * @function plane
 *
 * @return { THREE.Mesh } The planar THREE.Mesh
 *
 * @param { Object }           data     Parasolid data
 * @param { THREE.Material } material The material to give the THREE.Mesh
 */
function plane ( data, material ) {
    var geometry = new THREE.PlaneBufferGeometry( PLANE_DEFAULTS.WIDTH, PLANE_DEFAULTS.HEIGHT,
        PLANE_DEFAULTS.WIDTH_SEGMENTS, PLANE_DEFAULTS.HEIGHT_SEGMENTS );
    return new THREE.Mesh( geometry, material );
}


var solidPrimitives = Object.freeze({
  cone: cone,
  cylinder: cylinder,
  sphere: sphere,
  torus: torus,
  block: block,
  mesh: mesh,
  obj: obj,
  stl: stl,
  plane: plane
});

/**
 * Convert a material to hash like string.
 * The string will always be the same for the same property values,
 * and can be used to determine uniqueness of materials.
 * @param {constants.MATERIAL_TYPES} type The type of material
 * @param {THREE.material} m The material
 * @return {string} The result
 */
function materialToJson(type, m) {
    var knownProperties = DEFAULT_MATERIAL_PROPERTIES;
    var propertyNames = [];
    var prop;
    switch ( type ) {
        case MATERIAL_TYPES.PHONG: {
            propertyNames = Object.keys(knownProperties.phong);
            // Special case roughness since its not a real property, but determines uniqueness
            propertyNames.push('roughness');
            break;
        }
        case MATERIAL_TYPES.POINT: {
            propertyNames = Object.keys(knownProperties.point);
            break;
        }
        case MATERIAL_TYPES.LINE: {
            propertyNames = Object.keys(knownProperties.line);
            break;
        }
    }
    propertyNames.sort();
    var orderedMaterial =[];
    var i, len;
    for (i=0, len=propertyNames.length; i<len; i++) {
        prop = m[propertyNames[i]];
        if (prop) {
            orderedMaterial.push(prop);
        }
    }
    // Use the type (mesh, phong, line) as a namespace to separate materials
    var result = JSON.stringify(type);
    result += JSON.stringify(orderedMaterial);
    return result;
}

/**
 * Convert a color string or array to an object
 * @param {String|Array} color The html color
 * @returns {THREE.Color} The color object
 * @private
 */
function _convertColor(color) {
    if (color == null) {
        color = DEFAULT_MATERIAL_PROPERTIES.phong.color;
    }
    var newColor = new THREE.Color();
    if (typeof color === 'object' &&
        color.r !== undefined && color.g !== undefined && color.b !== undefined) {
        newColor.copy(color);
    } else if (typeof color === 'object' && color instanceof Array && color.length === 3) {
        newColor.setRGB(color[0], color[1], color[2]);
    } else {
        newColor.set(color);
    }
    return newColor;
}

/**
 * Find a parameter on the entity object data
 * @param {Object} data The entity parameters object
 * @param {String} attr The name of the desired attribute
 * @param {*} defaultAttr The default value for the attribute
 * @returns {*} The found property or the default
 * @private
 */
function _getEntityData(data, attr, defaultAttr) {
    if (!data) return defaultAttr;
    var value = defaultAttr;
    if (data[attr]) {
        value = data[attr];
    } else if (data.materialProperties && data.materialProperties[attr]) {
        value = data.materialProperties[attr];
    } else if (data.attributes && data.attributes.materialProperties && data.attributes.materialProperties[attr]) {
        value = data.attributes.materialProperties[attr];
    }
    return value;
}

/**
 * Placeholder used to determine list of valid entity names
 * @function point
 * @throws FluxGeometryError Always
 */
function point () {
    // Points are already handled in createPrimitive.js
    // since they are aggregated into one entity
    throw new FluxGeometryError('Something went wrong with our code.');
}

/**
 * Placeholder used to determine list of valid entity names
 * @function polycurve
 * @throws FluxGeometryError Always
 */
function polycurve () {
    // Polycurve entities are de-constructed into their constituent
    // entities during by _flattenData in createObject
    throw new FluxGeometryError('Something went wrong with our code.');
}

/**
 * Placeholder used to determine list of valid entity names
 * @function polysurface
 * @throws FluxGeometryError Always
 */
function polysurface ( ) {
    // Polysurface entities are de-constructed into their constituent
    // entities during by _flattenData in createObject
    throw new FluxGeometryError('Something went wrong with our code.');
}

/**
 * Placeholder used to determine list of valid entity names
 * @function brep
 * @throws FluxGeometryError Always
 */
function brep ( ) {
    // Breps are added to the async primitives and thus never rendered here
    throw new FluxGeometryError('Something went wrong with our code.');
}

/**
 * Creates a linear THREE.Mesh from parasolid data and a material
 *
 * @function text
 *
 * @return { THREE.Mesh } The linear THREE.Mesh
 *
 * @param { Object } data     Parasolid data
 */
function text ( data ) {
    var textHelper = new THREE.TextHelper( data.text, {
        size:       _getEntityData(data, 'size', undefined),
        resolution: _getEntityData(data, 'resolution', undefined),
        align:      _getEntityData(data, 'align', undefined)
    });
    textHelper.material.color = _convertColor(_getEntityData(data, 'color', 'black'));
    return textHelper;
}


var primitiveHelpers = Object.freeze({
    point: point,
    polycurve: polycurve,
    polysurface: polysurface,
    brep: brep,
    text: text
});

function UnitRegistry() {
    // Dimension (string) -> bool
    this.dimensions = {};

    // Unit -> dimension
    this.units = {};

    // Alias -> Unit
    this.aliases = {};

    // Unit -> {Unit -> Scale}}
    this.conversions = {};

}

/**
 * Add a unit as a known type that can be converted
 * @param {String} unit The name of the unit (ex 'feet')
 * @param {String} dim The name of the dimension (ex 'length')
 * @param {Array.<String>} aliases Other names for the same unit (ex ['foot', 'ft'])
 */
UnitRegistry.prototype.addUnit = function (unit, dim, aliases) {
    this.units[unit] = dim;
    for(var i=0;i<aliases.length;i++) {
        this.aliases[aliases[i]] = unit;
    }
};

/**
 * Determine the numeric value to convert between two linear units
 * @param {String} from The old unit name
 * @param {String} to The new unit name
 * @returns {Number} The multiplier
 */
UnitRegistry.prototype.unitConversionFactor = function (from, to) {
    var standardFrom = from;
    if (this.aliases[from]) {
        standardFrom = this.aliases[from];
    }
    // Don't need to convert same units or
    // units that are known, but don't have a conversion
    if (from === to || standardFrom === to) {
        return 1.0;
    }
    var conversionFrom = this.conversions[from];
    if (!conversionFrom) {
        if (standardFrom) {
            conversionFrom = this.conversions[standardFrom];
        }
    }
    if (conversionFrom) {
        return conversionFrom[to];
    }
    // Known units that are missing conversions are considered a pass through
    if (this.units[standardFrom] && this.units[to]) {
        return 1.0;
    }
    // TODO(Kyle): This should be a warning
    // https://vannevar.atlassian.net/browse/LIB3D-709
    // throw new FluxGeometryError('Could not convert units from "'+from+'" to '+to);
    return null;
};

/**
 * Modify all the numeric properties in an object
 * @param {Object} obj The thing to modify
 * @param {Number} factor The multiplier for each property
 * @returns {Object} The modified object
 * @private
 */
function _scaleProperties(obj, factor) {
    if (obj) {
        if (obj.constructor === Number) {
            return obj * factor;
        }
        if (obj.constructor === Array) {
            return obj.map(function (item) {
                return _scaleProperties(item, factor);
            });
        }
        // TODO handle objects if needed
    }
    return obj;
}

/**
 * Create a function to repeatedly convert a pair of units
 * @param {String} from The old units
 * @param {String} to The new units
 * @returns {Function} The conversion function
 */
UnitRegistry.prototype.unitConversionFunc = function (from, to) {
    var factor = this.unitConversionFactor(from, to);
    if (factor !== null) {
        return function (obj) {
            if (!obj) {
                throw new FluxGeometryError('Invalid unit string '+obj);
            } else if (obj.constructor === Number) {
                return obj * factor;
            }
            return _scaleProperties(obj, factor);
        };
    }
    return null;
};

/**
 * Add a new dimension that can be measured
 * @param {String} d The dimension
 */
UnitRegistry.prototype.addConcreteDimension = function (d) {
    this.dimensions[d] = true;
};

/**
 * Register a scale factor for a given unit conversion
 * @param {String} from Old units
 * @param {String} to New units
 * @param {Number} scale The relative scale of the units
 */
UnitRegistry.prototype.addConversion = function (from, to, scale) {

    if (!this.conversions[from]) {
        this.conversions[from] = {};
    }
    if (this.conversions[from][to] == null) {
        this.conversions[from][to] = scale;
    }
};

/**
 * Factory function to create a units registry with common values populated
 *
 * This is hand migrated code from units-of-measurement / flux-measure.
 * We did not use the emscripten based port because it was too large (~2MB)
 * for what is a reasonable amount of JavaScript code. Also the web viewer
 * only needs a subset of the units conversion logic to display geometry.
 * TODO: move all these function calls into a .json file containing
 * the data and have the code loop over it instead of being hard coded.
 * It is this way currently to match the structure of the other repository.
 *
 * @returns {UnitRegistry} The new registry
 */
UnitRegistry.newStandardRegistry = function () {
    var r = new UnitRegistry();
    r.addConcreteDimension("length");

    r.addUnit("microns", "length", ["um", "micron"]);
    r.addUnit("millimeters", "length", ["mm", "millimeter"]);
    r.addUnit("centimeters", "length", ["cm", "centimeter"]);
    r.addUnit("meters", "length", ["m", "meter"]);
    r.addUnit("kilometers", "length", ["km", "kilometer"]);

    r.addUnit("inches", "length", ["inch", "in"]);
    r.addUnit("feet", "length", ["ft", "foot"]);
    r.addUnit("miles", "length", ["mile"]);

    r.addConversion("microns", "meters", 1e-6);
    r.addConversion("millimeters", "meters", 1e-3);
    r.addConversion("centimeters", "meters", 1e-2);
    r.addConversion("kilometers", "meters", 1e3);
    r.addConversion("feet", "meters", 0.30480);
    r.addConversion("inches", "meters", 0.0254);


    //---- The rest of these units don't actually work, but we want to register that they exist
    r.addConcreteDimension("area");

    r.addUnit("acres", "area", []);
    r.addUnit("hectares", "area", []);

    r.addConcreteDimension("volume");
    r.addUnit("liters", "volume", ["liter", "l"]);
    r.addUnit("gallons", "volume", ["gallon", "gal"]);

    r.addConcreteDimension("temperature");
    r.addUnit("farenheit", "temperature", ["F"]);
    r.addUnit("celsius", "temperature", ["C"]);
    r.addUnit("kelvin", "temperature", ["K"]);

    r.addConcreteDimension("time");
    r.addUnit("nanoseconds", "time", ["nanosecond", "ns"]);
    r.addUnit("microseconds", "time", ["microsecond", "us"]);
    r.addUnit("milliseconds", "time", ["milisecond", "ms"]);
    r.addUnit("seconds", "time", ["second", "s"]);
    r.addUnit("minutes", "time", ["minute"]);
    r.addUnit("hours", "time", ["hour", "h"]);
    r.addUnit("days", "time", ["day"]);
    r.addUnit("weeks", "time", ["week"]);
    r.addUnit("years", "time", ["year"]);

    r.addConcreteDimension("angle");
    r.addUnit("radians", "angle", ["radian", "rad"]);
    r.addUnit("degrees", "angle", ["degree", "deg"]);

    r.addConcreteDimension("mass");
    r.addUnit("grams", "mass", ["gram", "g"]);
    r.addUnit("kilograms", "mass", ["kilogram", "kg"]);
    r.addUnit("pounds", "mass", ["pound", "lb"]); // Use 'pounds' to refer to mass.

    r.addConcreteDimension("force");
    r.addUnit("newtons", "force", ["newton"]);
    r.addUnit("pound-force", "force", ["lbf"]);

    r.addConcreteDimension("energy");
    r.addUnit("joules", "energy", ["joule"]);
    r.addUnit("kwh", "energy", ["kilowatt hour"]);

    r.addConcreteDimension("luminous-intensity");
    r.addUnit("candelas", "luminous-intensity", ["candela"]);

    return r;
};

var registry = UnitRegistry.newStandardRegistry();

/**
 * Find a property of an object, but ignore case
 * @param  {Object} obj  The dictionary
 * @param  {String} prop The case insensitive key
 * @return {Object}      The property or undefined
 */
function _lookupPropIgnoreCase(obj, prop) {
    var keys = Object.keys(obj);
    for (var i=0;i<keys.length;i++) {
        if (keys[i].toLocaleLowerCase() === prop.toLocaleLowerCase()) {
            return obj[keys[i]];
        }
    }
    return undefined;
}

/**
 * Set a property on an object if it matches the given one regardless of case.
 * @param {Object} obj   The object on which to set the property
 * @param {String} prop  The property name to set
 * @param {Object} value  The property value to set
 */
function _setPropIgnoreCase(obj, prop, value) {
    var keys = Object.keys(obj);
    for (var i=0;i<keys.length;i++) {
        if (keys[i].toLocaleLowerCase() === prop.toLocaleLowerCase()) {
            obj[keys[i]] = value;
            return;
        }
    }
    // If there was not case insensitive match, then add the property as new
    obj[prop] = value;
}


/**
 * Convert an entity to standardized units
 * @param {Object} entity Flux entity parameters object
 * @returns {Object} A copy of the entity with standardized units.
 */
function convertUnits (entity) {
    // Create a clone so that we can modify the properties in place
    var entityClone = JSON.parse(JSON.stringify(entity));
    if (!entityClone.units) {
        return entityClone;
    }
    var units = Object.keys(entityClone.units).sort();
    var i, j;
    // Iterate over each unit specification and set it on the object
    for (i=0;i<units.length;i++) {
        var unitString = units[i];
        var unitItems = unitString.trim().split('/');
        var unitPath = [];
        for (j = 0; j < unitItems.length; j++) {
            if (unitItems[j]) { // skip empty string
                unitPath.push(unitItems[j]);
            }
        }
        var unitMeasure = _lookupPropIgnoreCase(entityClone.units, unitString);
        var prop = entityClone;
        // Dig in to the next to last level so the property can be replaced
        for (j=0;j<unitPath.length-1;j++) {
            prop = _lookupPropIgnoreCase(prop,unitPath[j]);
            if (prop == null) {
                throw new FluxGeometryError('Invalid unit path '+unitString);
            }
        }
        var unitValue = _lookupPropIgnoreCase(prop,unitPath[j]);
        if (unitValue == null) {
            // TODO(Kyle): This should be a warning
            // https://vannevar.atlassian.net/browse/LIB3D-709
            // throw new FluxGeometryError('Invalid unit path ' + unitString);
            continue;
        }
        var func = registry.unitConversionFunc(unitMeasure, DEFAULT_UNITS);
        if (!func) {
            // TODO(Kyle): This should be a warning
            // https://vannevar.atlassian.net/browse/LIB3D-709
            // throw new FluxGeometryError('Invalid units specified');
            continue;
        }
        _setPropIgnoreCase(prop, unitPath[j], func(unitValue));
        entityClone.units[unitString] = DEFAULT_UNITS;
    }
    return entityClone;
}

/**
 * Determine the material type that would be used for a given primitive
 * @param {Object} primitive The geometry object parameters
 * @returns {{func: *, material: number}} A function to convert a prim to geomtry and a material type
 */
function resolveType (primitive) {
    var resolvedName = _resolveLegacyNames( primitive );

    var primFunction = primitiveHelpers[ resolvedName ];
    var materialType = MATERIAL_TYPES.PHONG;
    if (resolvedName === 'point') {
        materialType = MATERIAL_TYPES.POINT;
    }

    if (!primFunction) {
        primFunction = wirePrimitives[ resolvedName ];
        materialType = MATERIAL_TYPES.LINE;
    }
    if (!primFunction) {
        primFunction = sheetPrimitives[ resolvedName ];
        materialType = MATERIAL_TYPES.PHONG;
    }
    if (!primFunction) {
        primFunction = solidPrimitives[ resolvedName ];
        materialType = MATERIAL_TYPES.PHONG;
    }

    return { func: primFunction, material: materialType};
}
/**
 * Cache to prevent repetitive munging of arrays.
 * Stores all the acceptable primitive types for geometry.
 * @type {Array.<String>}
 */
var validPrimsList = null;

/**
 * Return a list of all the valid primitive strings
 * @return {Array.<String>} The list of primitives
 */
function listValidPrims ( ) {
    if (validPrimsList) return validPrimsList;

    validPrimsList = Object.keys(primitiveHelpers).concat(
                        Object.keys(solidPrimitives),
                        Object.keys(sheetPrimitives),
                        Object.keys(wirePrimitives),
                        Object.keys(LEGACY_NAMES_MAP));
    return validPrimsList;
}

/**
 * Get the point size from a given entity
 * @param {Array} prims Array of point data
 * @returns {Number} Point size
 * @private
 */
function _getPointSize(prims) {
    var size = DEFAULT_MATERIAL_PROPERTIES.point.size;
    // Just use the first point for now, can't set size per point.
    var prim = prims[0];
    if (!prim) return;
    var materialProperties = prim.materialProperties || (prim.attributes && prim.attributes.materialProperties);
    if (materialProperties && materialProperties.size) {
        size = materialProperties.size;
    }
    return size;
}

/**
 * Get the point size attenuation from a given entity
 * Determines whether the points change size based on distance to camera
 * @param {Array} prims Array of point data
 * @returns {Boolean} True when points change apparent size
 * @private
 */
function _getPointSizeAttenuation(prims) {
    // default to fixed size for 1 point, and attenuate for multiples
    var sizeAttenuation = prims.length !== 1;
    // Just use the first point for now, can't set attenuation per point.
    var prim = prims[0];

    if (!prim) {
        return sizeAttenuation;
    }
    var materialProperties = prim.materialProperties || (prim.attributes && prim.attributes.materialProperties);
    if (materialProperties && materialProperties.sizeAttenuation) {
        sizeAttenuation = materialProperties.sizeAttenuation;
    }
    return sizeAttenuation;
}

/**
 * Create the point cloud mesh for all the input primitives
 * @param {Object} prims List of point primitive objects
 * @returns {THREE.Points} An Object3D containing points
 */
function createPoints (prims) {
    var positions = new Float32Array(prims.length*3);
    var colors = new Float32Array(prims.length*3);
    for (var i=0;i<prims.length;i++) {
        var prim = convertUnits(prims[i]);
        positions[i*3] = prim.point[0];
        positions[i*3+1] = prim.point[1];
        positions[i*3+2] = prim.point[2]||0;
        // Get color or default color
        var color = _convertColor(_getEntityData(prim, 'color', DEFAULT_POINT_COLOR));
        colors[i*3] = color.r;
        colors[i*3+1] = color.g;
        colors[i*3+2] = color.b;
    }
    var geometry = new THREE.BufferGeometry();

    geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
    var materialProperties = {
        size: _getPointSize(prims),
        sizeAttenuation: _getPointSizeAttenuation(prims),
        vertexColors: THREE.VertexColors
    };
    var material = new THREE.PointsMaterial(materialProperties);
    var mesh = new THREE.Points( geometry, material );

    _convertToZUp( mesh );

    return mesh;
}

/**
 * Creates the ParaSolid Object
 *
 * @function createPrimitive
 * @return { THREE.Mesh } The created mesh
 * @throws FluxGeometryError if unsupported geometry is found
 *
 * @param { Object } data The data to create the object with
 * @param { GeometryResults } geomResult The container for the geometry and caches
 */
function createPrimitive ( data, geomResult ) {
    var type = resolveType(data.primitive);

    // Check that the entity matches a schema, otherwise return no geometry
    if (!geomResult.checkSchema(data)) {
        return;
    }
    // Get a new clone of the data with different units for rendering
    var dataNormalized = convertUnits(data);

    var materialProperties = _findMaterialProperties( dataNormalized );
    var material = _createMaterial( type.material, materialProperties, geomResult.cubeArray );

    var primFunction = type.func;
    if (!primFunction) return;

    var mesh = primFunction( dataNormalized, material );

    if ( mesh ) {
        if (mesh.geometry) {
            geomResult._geometryMaterialMap[mesh.geometry.id] = material.name;
        }
        return cleanupMesh(mesh, dataNormalized, materialProperties);
    }

    throw new FluxGeometryError( 'Unsupported geometry type: ' + dataNormalized.primitive );

}

/**
 * Move the color from a material to a geometry.
 *
 * This allows meshes of different colors to be merged together.
 * Then the meshes can share a single material with per vertex color.
 *
 * @precondition The color object on the material should not be shared with other materials.
 * @param {THREE.Geometry} mesh The mesh containing geometry and material to manipulate
 * @private
 */
function _moveMaterialColorToGeom(mesh) {
    var geom = mesh.geometry;
    var color = mesh.material.color;
    var color2 = color.clone();
    if (geom) {
        if (geom.type.indexOf('BufferGeometry') !== -1) {
            // Set the color as a buffer attribute
            var attrLen = geom.attributes.position.array.length;
            var colors = [];
            for (var i=0;i<attrLen;i+=3) {
                colors.push(color.r);
                colors.push(color.g);
                colors.push(color.b);
            }
            geom.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array(colors), 3 ) );
        } else if (geom.faces.length > 0) {
            // Set the color per face
            for (var f=0;f<geom.faces.length;f++) {
                geom.faces[f].color = color2;
            }
        } else {
            // Lines have a colors array since they don't have faces
            for (var c=0;c<geom.vertices.length;c++) {
                geom.colors[c] = color2;
            }
            geom.colorsNeedUpdate = true;
        }
        // Reset the color since it is now on the points.
        // In three.js color is multiplicative, so:
        // color = material color * vertex color
        // Hence after setting it on the mesh, it must be reset on the material.
        color.r = 1;
        color.g = 1;
        color.b = 1;
    }
}

/**
 * Do some post processing to the mesh to prep it for Flux
 * @param {THREE.Object3D} mesh Geometry and material object
 * @param {Object} data The entity object
 * @returns {THREE.Mesh} The processed mesh
 */
function cleanupMesh(mesh, data) {
    // Text helper is ignored, due to it's own special materials.
    if (mesh.type !== "textHelper") {
        // Convert all geometry in the object tree
        mesh.traverse(function (child) {
            // Only convert the color for objects with material
            if (child.material) {
                _moveMaterialColorToGeom(child);
            }
        });
    }

    _convertToZUp( mesh );

    if (!data) return;

    if ( data.origin ) _applyOrigin( mesh, data.origin );

    var axis = data.axis || data.direction || data.normal;

    if ( axis )
        mesh.lookAt( mesh.position.clone().add(
            new THREE.Vector3(
                axis[ 0 ],
                axis[ 1 ],
                axis[ 2 ]
            )
        ));

    if ( data.attributes && data.attributes.tag ) mesh.userData.tag = data.attributes.tag;

    return mesh;
}

/**
 * Helper method to find the material properties on the data
 *
 * @function _findMaterialProperties
 * @private
 *
 * @return { Object } The material properties
 *
 * @param { Object } data The data used to construct the primitive
 */
function _findMaterialProperties ( data ) {
    if ( data.attributes && data.attributes.materialProperties ) return data.attributes.materialProperties;
    else if ( data.materialProperties ) return data.materialProperties;
    else return {
        side: THREE.DoubleSide
    };
}

/**
 * Function to copy white listed properties from the input to the output
 * @param {Object} knownPropsMap Map from material properties to defualt values
 * @param {Object} propsIn Map from material properties to values
 * @param {Object} propsOut Subset of propsIn (return parameter)
 * @private
 */
function _addKnownProps(knownPropsMap, propsIn, propsOut) {
    var knownProps = Object.keys(knownPropsMap);
    for (var i=0;i<knownProps.length;i++) {
        var prop = knownProps[i];
        var propValue = propsIn[prop];
        if (propValue != null) {
            propsOut[prop] = propValue;
        }
    }
}

/**
 * Modify a material to approximate a shading model with roughness
 * @param {Number} roughness        The roughness (measures shiny to matte)
 * @param {THREE.Material} material The material to edit
 * @param {Array} cubeArray         Array of textures
 * @private
 */
function _applyRoughness(roughness, material, cubeArray) {
    if (roughness != null && cubeArray != null) {
        // There are some magic numbers here to simulate physically-accurate lighting.
        // This is only an artistic approximation of physically-accurate models.
        // TODO(aki): implement custom shader with better lighting model.
        material.envMap = cubeArray[Math.floor(Math.pow(roughness, 0.2) * 8)];
        // TODO(aki): Colored materials have clear white reflection.
        material.combine = THREE.AddOperation;
        material.reflectivity = 1 - roughness * 1;
        if (material.color.r !== 1 || material.color.g !== 1 || material.color.b !== 1) {
            var hsl = material.color.getHSL();
            material.reflectivity *= Math.pow(hsl.l, 2);
            material.specular = material.color.clone();
            material.color.multiplyScalar(Math.pow(roughness, 0.3));
            material.specular.multiplyScalar(1 - Math.pow(roughness, 2));
        }
    }
}

/**
 * Helper method to create the material from the material properties.
 * There are only a few types of materials used, this function takes a type
 * and returns a material with the properties object given
 *
 * @function _createMaterial
 * @private
 *
 * @return { THREE.Material } an instance of a Three.js material
 *
 * @param { Number } type               A member of the enumeration of material types
 *                                      present in the parasolid utility
 *
 * @param { Object } materialProperties A set of properties that functions
 *                                      as options for the material
 * @param {Array} cubeArray             Array of textures
 */
function _createMaterial ( type, materialProperties, cubeArray ) {
    var material;
    // Just the properties that actually make sense for this material
    var props = {};
    // Add sidedness to local state if it is not present
    if ( materialProperties && !materialProperties.side ) {
        props.side = THREE.DoubleSide;
    }
    // Create a material of the appropriate type
    if ( type === MATERIAL_TYPES.PHONG ) {
        // Add material properties related to shadows. This is an offset
        // to prevent z-fighting with stencil buffer shadows and their host object
        props.polygonOffset = true;
        props.polygonOffsetFactor = 1;
        props.polygonOffsetUnits = 1;
        props.vertexColors = THREE.VertexColors;

        _addKnownProps(DEFAULT_MATERIAL_PROPERTIES.phong, materialProperties, props);
        material = new THREE.MeshPhongMaterial( props );
        material.color = _convertColor(materialProperties.color||DEFAULT_PHONG_COLOR);

        // Apply roughness (modifies color and other material object properties)
        _applyRoughness(materialProperties.roughness, material, cubeArray);
        if (materialProperties.roughness) props.roughness = materialProperties.roughness;

    } else if ( type === MATERIAL_TYPES.POINT ) {

        _addKnownProps(DEFAULT_MATERIAL_PROPERTIES.point, materialProperties, props);
        material = new THREE.PointsMaterial( props );
        material.color = _convertColor(materialProperties.color||DEFAULT_POINT_COLOR);

    } else if ( type === MATERIAL_TYPES.LINE ) {

        props.vertexColors = THREE.VertexColors;
        _addKnownProps(DEFAULT_MATERIAL_PROPERTIES.line, materialProperties, props);
        material = new THREE.LineBasicMaterial( props );
        material.color = _convertColor(materialProperties.color||DEFAULT_LINE_COLOR);
    }
    // Use the material's name to track uniqueness of it's source
    material.name = materialToJson(type, props);

    if (material.opacity < 1) {
        material.transparent = true;
    }

    return material;

}

/**
 * A helper to resolve legacy names to present names. This prevents deprication
 * of some of our user's parasolid data.
 *
 * @function _resolveLegacyNames
 * @private
 *
 * @return { String } the current name
 *
 * @param { String } name a name that may be legacy
 */
function _resolveLegacyNames ( name ) {
    var legacyMap = LEGACY_NAMES_MAP;
    if (Object.keys(legacyMap).indexOf(name) !== -1)
        return legacyMap[name];
    return name;
}

/**
 * A helper to convert geometry to z-up world by setting ups axis and rotation
 * order
 *
 * @function _convertToZUp
 * @private
 *
 * @param { THREE.Object3D } object The object to convert to z-up
 */
function _convertToZUp ( object ) {
    object.up.set( 0, 0, 1 );
    object.rotation.order = 'YXZ';
}

/**
 * A helper to apply an origin to a mesh
 *
 * @function _applyOrigin
 * @private
 *
 * @param { THREE.Mesh } mesh The mesh to receive the origin
 * @param { Array } origin The vector representing the origin
 */
function _applyOrigin ( mesh, origin ) {
    mesh.position.set(
        origin[ 0 ],
        origin[ 1 ],
        origin[ 2 ] ? origin[ 2 ] : 0
    );
}

var $schema = "http://json-schema.org/draft-04/schema#";
var scene = {"type":"object","properties":{"Entities":{"$ref":"#/scene/entities"},"Operations":{"$ref":"#/scene/operations"}},"required":["Entities","Operations"],"additionalProperties":false,"operations":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"op":{"$ref":"#/scene/operation"}},"additionalProperties":false}},"operation":{"oneOf":[{"type":"boolean"},{"type":"number"},{"type":"string"},{"type":"array","items":[{"type":"string"}],"minItems":1,"additionalItems":{"$ref":"#/scene/operation"}}]},"entities":{"type":"object","minProperties":1,"items":{"$ref":"#/scene/entity"}},"entity":{"oneOf":[{"type":"array","items":{"$ref":"#/scene/entity"}},{"oneOf":[{"$ref":"#/entities/empty"},{"$ref":"#/entities/number"},{"$ref":"#/entities/brep"},{"$ref":"#/entities/vector"},{"$ref":"#/entities/point"},{"$ref":"#/entities/plane"},{"$ref":"#/entities/affineTransform"},{"$ref":"#/entities/massProps"},{"$ref":"#/entities/line"},{"$ref":"#/entities/polyline"},{"$ref":"#/entities/circle"},{"$ref":"#/entities/ellipse"},{"$ref":"#/entities/curve"},{"$ref":"#/entities/arc"},{"$ref":"#/entities/rectangle"},{"$ref":"#/entities/polycurve"},{"$ref":"#/entities/polygonSet"},{"$ref":"#/entities/surface"},{"$ref":"#/entities/polysurface"},{"$ref":"#/entities/block"},{"$ref":"#/entities/torus"},{"$ref":"#/entities/sphere"},{"$ref":"#/entities/cylinder"},{"$ref":"#/entities/cone"},{"$ref":"#/entities/mesh"}]}]}};
var types = {"brep_format":{"enum":["x_b","x_t","iges","step","sat","sab","stl"]},"index":{"type":"integer","minimum":0},"index-nonzero":{"type":"integer","minimum":0,"exclusiveMinimum":true},"direction":{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3},"angle":{"type":"number","fluxDimension":"angle"},"coordinate":{"type":"number","fluxDimension":"length"},"distance":{"type":"number","minimum":0,"fluxDimension":"length"},"area":{"type":"number","minimum":0,"fluxDimension":"area"},"volume":{"type":"number","minimum":0,"fluxDimension":"volume"},"distance-nonzero":{"type":"number","minimum":0,"exclusiveMinimum":true,"fluxDimension":"length"},"position":{"type":"array","items":{"$ref":"#/types/coordinate"},"minItems":3,"maxItems":3},"dimensions":{"type":"array","items":{"$ref":"#/types/distance-nonzero"},"minItems":3,"maxItems":3},"units":{"type":"object","additionalProperties":false,"patternProperties":{".*":{"type":"string"}}}};
var entities = {"empty":{"type":"object","additionalProperties":false},"number":{"type":"number"},"brep":{"type":"object","properties":{"primitive":{"enum":["brep"]},"content":{"type":"string"},"format":{"$ref":"#/types/brep_format"},"isCompressed":{"type":"boolean"},"isBase64":{"type":"boolean"},"vertices":{"type":"array","items":{"$ref":"#/types/position"}},"faces":{"type":"array","items":{"type":"array","items":{"$ref":"#/types/index"},"minItems":3}},"attributes":{}},"required":["primitive","content","format"]},"vector":{"type":"object","properties":{"primitive":{"enum":["vector"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"coords":{"$ref":"#/types/position"}},"required":["primitive","coords"]},"point":{"type":"object","properties":{"primitive":{"enum":["point"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"point":{"$ref":"#/types/position"}},"required":["primitive","point"]},"plane":{"type":"object","properties":{"primitive":{"enum":["plane"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"normal":{"$ref":"#/types/direction"}},"required":["primitive","origin","normal"]},"affineTransform":{"type":"object","properties":{"primitive":{"enum":["affineTransform"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"mat":{"type":"array","items":{"type":"number"},"minItems":16,"maxItems":16,"fluxDimension":"affineMatrix"}},"required":["primitive","mat"],"additionalProperties":false},"massProps":{"type":"object","properties":{"primitive":{"enum":["massProps"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"mass":{"$ref":"#/types/distance"},"centerOfMass":{"$ref":"#/types/position"},"inertiaTensor":{"type":"array","items":{"$ref":"#/types/direction"},"minItems":3,"maxItems":3},"volume":{"$ref":"#/types/volume"},"surfaceArea":{"$ref":"#/types/area"},"length":{"$ref":"#/types/distance"},"circumference":{"$ref":"#/types/distance"}},"required":["primitive","mass","centerOfMass","inertiaTensor"],"additionalProperties":false},"line":{"type":"object","properties":{"primitive":{"enum":["line"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"start":{"$ref":"#/types/position"},"end":{"$ref":"#/types/position"}},"required":["primitive","start","end"]},"polyline":{"type":"object","properties":{"primitive":{"enum":["polyline"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"points":{"type":"array","items":{"$ref":"#/types/position"},"minItems":2}},"required":["primitive","points"]},"circle":{"type":"object","properties":{"primitive":{"enum":["circle"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","radius"]},"ellipse":{"type":"object","properties":{"primitive":{"enum":["ellipse"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"majorRadius":{"$ref":"#/types/distance-nonzero"},"minorRadius":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"},"reference":{"$ref":"#/types/direction"}},"required":["primitive","origin","majorRadius","minorRadius"]},"curve":{"type":"object","properties":{"primitive":{"enum":["curve"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"degree":{"$ref":"#/types/index-nonzero"},"controlPoints":{"type":"array","items":{"$ref":"#/types/position"}},"knots":{"type":"array","items":{"type":"number"}},"weights":{"type":"array","items":{"type":"number"}}},"required":["primitive","degree","controlPoints","knots"]},"arc":{"type":"object","properties":{"primitive":{"enum":["arc"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"start":{"$ref":"#/types/position"},"middle":{"$ref":"#/types/position"},"end":{"$ref":"#/types/position"}},"required":["primitive","start","middle","end"]},"rectangle":{"type":"object","properties":{"primitive":{"enum":["rectangle"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"dimensions":{"type":"array","items":{"$ref":"#/types/distance-nonzero"},"minItems":2,"maxItems":2,"additionalItems":false},"axis":{"$ref":"#/types/direction"},"reference":{"$ref":"#/types/direction"}},"required":["primitive","origin","dimensions"]},"polycurve":{"type":"object","properties":{"primitive":{"enum":["polycurve"]},"__repr__":{"type":"string"},"attributes":{},"curves":{"type":"array","minItems":1,"items":{"oneOf":[{"$ref":"#/entities/line"},{"$ref":"#/entities/polyline"},{"$ref":"#/entities/curve"},{"$ref":"#/entities/arc"}]}}},"required":["primitive","curves"]},"polygonSet":{"type":"object","properties":{"primitive":{"enum":["polygonSet"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"polygons":{"type":"array","items":{"type":"object","properties":{"boundary":{"$ref":"#/entities/polygonSet/polygon"},"holes":{"type":"array","items":{"$ref":"#/entities/polygonSet/polygon"}}},"required":["boundary","holes"],"additionalProperties":false},"minItems":1}},"required":["primitive","polygons"],"polygon":{"type":"array","items":{"$ref":"#/types/position"},"minItems":3}},"surface":{"type":"object","properties":{"primitive":{"enum":["surface"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"uDegree":{"$ref":"#/types/index-nonzero"},"vDegree":{"$ref":"#/types/index-nonzero"},"uKnots":{"type":"array","items":{"type":"number"}},"vKnots":{"type":"array","items":{"type":"number"}},"controlPoints":{"type":"array","items":{"type":"array","items":{"$ref":"#/types/position"}}},"weights":{"type":"array","items":{"type":"number"}}},"required":["primitive","uDegree","vDegree","uKnots","vKnots","controlPoints"]},"polysurface":{"type":"object","properties":{"primitive":{"enum":["polysurface"]},"__repr__":{"type":"string"},"attributes":{},"surfaces":{"type":"array","items":{"oneOf":[{"$ref":"#/entities/polygonSet"},{"$ref":"#/entities/surface"}]},"minItems":1}},"required":["primitive","surfaces"]},"block":{"type":"object","properties":{"primitive":{"enum":["block"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"dimensions":{"$ref":"#/types/dimensions"},"axis":{"$ref":"#/types/direction"},"reference":{"$ref":"#/types/direction"}},"required":["primitive","origin","dimensions"]},"torus":{"type":"object","properties":{"primitive":{"enum":["torus"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"majorRadius":{"$ref":"#/types/coordinate"},"minorRadius":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","majorRadius","minorRadius"]},"sphere":{"type":"object","properties":{"primitive":{"enum":["sphere"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"}},"required":["primitive","origin","radius"]},"cylinder":{"type":"object","properties":{"primitive":{"enum":["cylinder"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"},"height":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","radius","height"]},"cone":{"type":"object","properties":{"primitive":{"enum":["cone"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"},"height":{"$ref":"#/types/distance-nonzero"},"semiAngle":{"$ref":"#/types/angle"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","radius","height","semiAngle"]},"mesh":{"type":"object","properties":{"primitive":{"enum":["mesh"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"vertices":{"type":"array","items":{"$ref":"#/types/position"}},"faces":{"type":"array","items":{"type":"array","items":{"$ref":"#/types/index"},"minItems":3}}},"required":["primitive","vertices","faces"]}};
var psworker = {
	$schema: $schema,
	scene: scene,
	types: types,
	entities: entities,
	"block-request": {"type":"object","properties":{"Label":{"type":"string"},"Inputs":{"type":"array","items":{"$ref":"#/block-request/input"}}},"required":["Inputs"],"input":{"anyOf":[{"type":"object","properties":{"Name":{"enum":["Scene"]},"Value":{"$ref":"#/scene"}},"required":["Name","Value"]},{"type":"object","properties":{"Name":{"type":"string"},"Value":{}},"required":["Name","Value"]}]}},
	"block-response": {"type":"object","properties":{"Done":{"type":"boolean"},"Stats":{"type":"object","properties":{"DecodingTime":{"type":"number"},"CpuTime":{"type":"number"},"EncodingTime":{"type":"number"},"Latency":{"type":"number"}},"additionalProperties":false},"Log":{"type":"string"},"Outputs":{"type":"object","properties":{"Results":{"$ref":"#/scene/entities"}},"additionalProperties":false},"Error":{"type":"string"}},"required":["Done","Stats"],"additionalProperties":false}
};

var schemaJson = Object.freeze({
	$schema: $schema,
	scene: scene,
	types: types,
	entities: entities,
	default: psworker
});

var ajv_min = (function (module, global) {
var exports = module.exports;
/* ajv 3.8.10: Another JSON Schema Validator */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var r;r="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,r.Ajv=e()}}(function(){var define,module,exports;return function e(r,t,a){function s(i,n){if(!t[i]){if(!r[i]){var l="function"==typeof require&&require;if(!n&&l)return l(i,!0);if(o)return o(i,!0);var c=new Error("Cannot find module '"+i+"'");throw c.code="MODULE_NOT_FOUND",c}var h=t[i]={exports:{}};r[i][0].call(h.exports,function(e){var t=r[i][1][e];return s(t?t:e)},h,h.exports,e,r,t,a)}return t[i].exports}for(var o="function"==typeof require&&require,i=0;a.length>i;i++)s(a[i]);return s}({1:[function(require,module,exports){"use strict";function setupAsync(e,r){r!==!1&&(r=!0);var t,a=e.async,s=e.transpile;switch(typeof s){case"string":var o=TRANSPILE[s];if(!o)throw new Error("bad transpiler: "+s);return e._transpileFunc=o(e,r);case"undefined":case"boolean":if("string"==typeof a){if(t=ASYNC[a],!t)throw new Error("bad async mode: "+a);return e.transpile=t(e,r)}for(var i=0;MODES.length>i;i++){var n=MODES[i];if(setupAsync(n,!1))return util.copy(n,e),e.transpile}throw new Error("generators, nodent and regenerator are not available");case"function":return e._transpileFunc=e.transpile;default:throw new Error("bad transpiler: "+s)}}function checkGenerators(opts,required){try{return eval("(function*(){})()"),!0}catch(e){if(required)throw new Error("generators not supported")}}function checkAsyncFunction(opts,required){try{return eval("(async function(){})()"),!0}catch(e){if(required)throw new Error("es7 async functions not supported")}}function getRegenerator(e,r){try{return regenerator||(regenerator=require("regenerator"),regenerator.runtime()),e.async&&e.async!==!0||(e.async="es7"),regeneratorTranspile}catch(t){if(r)throw new Error("regenerator not available")}}function regeneratorTranspile(e){return regenerator.compile(e).code}function getNodent(e,r){try{return nodent||(nodent=require("nodent")({log:!1,dontInstallRequireHook:!0})),"es7"!=e.async&&(e.async&&e.async!==!0&&console.warn("nodent transpiles only es7 async functions"),e.async="es7"),nodentTranspile}catch(t){if(r)throw new Error("nodent not available")}}function nodentTranspile(e){return nodent.compile(e,"",{promises:!0,sourcemap:!1}).code}function compileAsync(e,r){function t(e,r,a){function o(a){function o(a,o){if(a)return r(a);if(!s._refs[i]&&!s._schemas[i])try{s.addSchema(o,i)}catch(n){return void r(n)}t(e,r)}var i=a.missingSchema;if(s._refs[i]||s._schemas[i])return r(new Error("Schema "+i+" is loaded but"+a.missingRef+"cannot be resolved"));var n=s._loadingSchemas[i];n?"function"==typeof n?s._loadingSchemas[i]=[n,o]:n[n.length]=o:(s._loadingSchemas[i]=o,s._opts.loadSchema(i,function(e,r){var t=s._loadingSchemas[i];if(delete s._loadingSchemas[i],"function"==typeof t)t(e,r);else for(var a=0;t.length>a;a++)t[a](e,r)}))}function i(e,t){return a?void setTimeout(function(){r(e,t)}):r(e,t)}var n;try{n=s.compile(e)}catch(l){return void(l.missingSchema?o(l):i(l))}i(null,n)}var a,s=this;try{a=this._addSchema(e)}catch(o){return void setTimeout(function(){r(o)})}if(a.validate)setTimeout(function(){r(null,a.validate)});else{if("function"!=typeof this._opts.loadSchema)throw new Error("options.loadSchema should be a function");t(e,r,!0)}}module.exports={setup:setupAsync,compile:compileAsync};var util=require("./compile/util"),ASYNC={"*":checkGenerators,"co*":checkGenerators,es7:checkAsyncFunction},TRANSPILE={nodent:getNodent,regenerator:getRegenerator},MODES=[{async:"co*"},{async:"es7",transpile:"nodent"},{async:"co*",transpile:"regenerator"}],regenerator,nodent},{"./compile/util":10}],2:[function(e,r,t){"use strict";var a=r.exports=function(){this._cache={}};a.prototype.put=function(e,r){this._cache[e]=r},a.prototype.get=function(e){return this._cache[e]},a.prototype.del=function(e){delete this._cache[e]},a.prototype.clear=function(){this._cache={}}},{}],3:[function(e,r,t){"use strict";r.exports={$ref:e("../dotjs/ref"),allOf:e("../dotjs/allOf"),anyOf:e("../dotjs/anyOf"),dependencies:e("../dotjs/dependencies"),"enum":e("../dotjs/enum"),format:e("../dotjs/format"),items:e("../dotjs/items"),maximum:e("../dotjs/_limit"),minimum:e("../dotjs/_limit"),maxItems:e("../dotjs/_limitItems"),minItems:e("../dotjs/_limitItems"),maxLength:e("../dotjs/_limitLength"),minLength:e("../dotjs/_limitLength"),maxProperties:e("../dotjs/_limitProperties"),minProperties:e("../dotjs/_limitProperties"),multipleOf:e("../dotjs/multipleOf"),not:e("../dotjs/not"),oneOf:e("../dotjs/oneOf"),pattern:e("../dotjs/pattern"),properties:e("../dotjs/properties"),required:e("../dotjs/required"),uniqueItems:e("../dotjs/uniqueItems"),validate:e("../dotjs/validate")}},{"../dotjs/_limit":13,"../dotjs/_limitItems":14,"../dotjs/_limitLength":15,"../dotjs/_limitProperties":16,"../dotjs/allOf":17,"../dotjs/anyOf":18,"../dotjs/dependencies":20,"../dotjs/enum":21,"../dotjs/format":22,"../dotjs/items":23,"../dotjs/multipleOf":24,"../dotjs/not":25,"../dotjs/oneOf":26,"../dotjs/pattern":27,"../dotjs/properties":29,"../dotjs/ref":30,"../dotjs/required":31,"../dotjs/uniqueItems":33,"../dotjs/validate":34}],4:[function(e,r,t){"use strict";r.exports=function a(e,r){if(e===r)return!0;var t,s=Array.isArray(e),o=Array.isArray(r);if(s&&o){if(e.length!=r.length)return!1;for(t=0;e.length>t;t++)if(!a(e[t],r[t]))return!1;return!0}if(s!=o)return!1;if(e&&r&&"object"==typeof e&&"object"==typeof r){var i=Object.keys(e);if(i.length!==Object.keys(r).length)return!1;for(t=0;i.length>t;t++)if(void 0===r[i[t]])return!1;for(t=0;i.length>t;t++)if(!a(e[i[t]],r[i[t]]))return!1;return!0}return!1}},{}],5:[function(e,r,t){"use strict";function a(e){e="full"==e?"full":"fast";var r=d.copy(a[e]);for(var t in a.compare)r[t]={validate:r[t],compare:a.compare[t]};return r}function s(e){var r=e.match(p);if(!r)return!1;var t=+r[1],a=+r[2];return t>=1&&12>=t&&a>=1&&m[t]>=a}function o(e,r){var t=e.match(v);if(!t)return!1;var a=t[1],s=t[2],o=t[3],i=t[5];return 23>=a&&59>=s&&59>=o&&(!r||i)}function i(e){var r=e.split(w);return s(r[0])&&o(r[1],!0)}function n(e){return 255>=e.length&&y.test(e)}function l(e){return j.test(e)&&g.test(e)}function c(e){try{return new RegExp(e),!0}catch(r){return!1}}function h(e,r){return e&&r?e>r?1:r>e?-1:e===r?0:void 0:void 0}function u(e,r){return e&&r&&(e=e.match(v),r=r.match(v),e&&r)?(e=e[1]+e[2]+e[3]+(e[4]||""),r=r[1]+r[2]+r[3]+(r[4]||""),e>r?1:r>e?-1:e===r?0:void 0):void 0}function f(e,r){if(e&&r){e=e.split(w),r=r.split(w);var t=h(e[0],r[0]);if(void 0!==t)return t||u(e[1],r[1])}}var d=e("./util"),p=/^\d\d\d\d-(\d\d)-(\d\d)$/,m=[0,31,29,31,30,31,30,31,31,30,31,30,31],v=/^(\d\d):(\d\d):(\d\d)(\.\d+)?(z|[+-]\d\d:\d\d)?$/i,y=/^[a-z](?:(?:[-0-9a-z]{0,61})?[0-9a-z])?(\.[a-z](?:(?:[-0-9a-z]{0,61})?[0-9a-z])?)*$/i,g=/^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@\/?]|%[0-9a-f]{2})*)?(?:\#(?:[a-z0-9\-._~!$&'()*+,;=:@\/?]|%[0-9a-f]{2})*)?$/i,P=/^(?:urn\:uuid\:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,E=/^(?:\/(?:[^~\/]|~0|~1)+)*(?:\/)?$|^\#(?:\/(?:[a-z0-9_\-\.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)+)*(?:\/)?$/i,b=/^(?:0|[1-9][0-9]*)(?:\#|(?:\/(?:[^~\/]|~0|~1)+)*(?:\/)?)$/;r.exports=a,a.fast={date:/^\d\d\d\d-[0-1]\d-[0-3]\d$/,time:/^[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:z|[+-]\d\d:\d\d)?$/i,"date-time":/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s][0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:z|[+-]\d\d:\d\d)$/i,uri:/^(?:[a-z][a-z0-9+-.]*)?(?:\:|\/)\/?[^\s]*$/i,email:/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,hostname:y,ipv4:/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,ipv6:/^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,regex:c,uuid:P,"json-pointer":E,"relative-json-pointer":b},a.full={date:s,time:o,"date-time":i,uri:l,email:/^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&''*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,hostname:n,ipv4:/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,ipv6:/^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,regex:c,uuid:P,"json-pointer":E,"relative-json-pointer":b},a.compare={date:h,time:u,"date-time":f};var w=/t|\s/i,j=/\/|\:/},{"./util":10}],6:[function(require,module,exports){"use strict";function compile(schema,root,localRefs,baseId){function localCompile(_schema,_root,localRefs,baseId){var isRoot=!_root||_root&&_root.schema==_schema;if(_root.schema!=root.schema)return compile.call(self,_schema,_root,localRefs,baseId);var $async=_schema.$async===!0;$async&&!opts.transpile&&async.setup(opts);var sourceCode=validateGenerator({isTop:!0,schema:_schema,isRoot:isRoot,baseId:baseId,root:_root,schemaPath:"",errSchemaPath:"#",errorPath:'""',RULES:RULES,validate:validateGenerator,util:util,resolve:resolve,resolveRef:resolveRef,usePattern:usePattern,useDefault:useDefault,useCustomRule:useCustomRule,opts:opts,formats:formats,self:self});sourceCode=vars(refVal,refValCode)+vars(patterns,patternCode)+vars(defaults,defaultCode)+vars(customRules,customRuleCode)+sourceCode,opts.beautify&&(beautify?sourceCode=beautify(sourceCode,opts.beautify):console.error('"npm install js-beautify" to use beautify option'));var validate,validateCode,transpile=opts._transpileFunc;try{validateCode=$async&&transpile?transpile(sourceCode):sourceCode,eval(validateCode),refVal[0]=validate}catch(e){throw console.error("Error compiling schema, function code:",validateCode),e}return validate.schema=_schema,validate.errors=null,validate.refs=refs,validate.refVal=refVal,validate.root=isRoot?validate:_root,$async&&(validate.async=!0),validate.sourceCode=sourceCode,validate}function resolveRef(e,r,t){r=resolve.url(e,r);var a,s,o=refs[r];if(void 0!==o)return a=refVal[o],s="refVal["+o+"]",resolvedRef(a,s);if(!t){var i=root.refs[r];if(void 0!==i)return a=root.refVal[i],s=addLocalRef(r,a),resolvedRef(a,s)}s=addLocalRef(r);var n=resolve.call(self,localCompile,root,r);if(!n){var l=localRefs&&localRefs[r];l&&(n=resolve.inlineRef(l,opts.inlineRefs)?l:compile.call(self,l,root,localRefs,e))}return n?(replaceLocalRef(r,n),resolvedRef(n,s)):void 0}function addLocalRef(e,r){var t=refVal.length;return refVal[t]=r,refs[e]=t,"refVal"+t}function replaceLocalRef(e,r){var t=refs[e];refVal[t]=r}function resolvedRef(e,r){return"object"==typeof e?{code:r,schema:e,inline:!0}:{code:r,async:e&&e.async}}function usePattern(e){var r=patternsHash[e];return void 0===r&&(r=patternsHash[e]=patterns.length,patterns[r]=e),"pattern"+r}function useDefault(e){switch(typeof e){case"boolean":case"number":return""+e;case"string":return util.toQuotedString(e);case"object":if(null===e)return"null";var r=stableStringify(e),t=defaultsHash[r];return void 0===t&&(t=defaultsHash[r]=defaults.length,defaults[t]=e),"default"+t}}function useCustomRule(e,r,t,a){var s,o=e.definition.compile,i=e.definition.inline,n=e.definition.macro;o?s=o.call(self,r,t):n?(s=n.call(self,r,t),opts.validateSchema!==!1&&self.validateSchema(s,!0)):s=i?i.call(self,a,e.keyword,r,t):e.definition.validate;var l=customRules.length;return customRules[l]=s,{code:"customRule"+l,validate:s}}var self=this,opts=this._opts,refVal=[void 0],refs={},patterns=[],patternsHash={},defaults=[],defaultsHash={},customRules=[];root=root||{schema:schema,refVal:refVal,refs:refs};var formats=this._formats,RULES=this.RULES;return localCompile(schema,root,localRefs,baseId)}function patternCode(e,r){return"var pattern"+e+" = new RegExp("+util.toQuotedString(r[e])+");"}function defaultCode(e){return"var default"+e+" = defaults["+e+"];"}function refValCode(e,r){return r[e]?"var refVal"+e+" = refVal["+e+"];":""}function customRuleCode(e){return"var customRule"+e+" = customRules["+e+"];"}function vars(e,r){if(!e.length)return"";for(var t="",a=0;e.length>a;a++)t+=r(a,e);return t}var resolve=require("./resolve"),util=require("./util"),stableStringify=require("json-stable-stringify"),async=require("../async"),beautify=function(){try{return require("js-beautify").js_beautify}catch(e){}}(),validateGenerator=require("../dotjs/validate");module.exports=compile;var co=require("co"),ucs2length=util.ucs2length,equal=require("./equal"),ValidationError=require("./validation_error")},{"../async":1,"../dotjs/validate":34,"./equal":4,"./resolve":7,"./util":10,"./validation_error":11,co:45,"json-stable-stringify":46}],7:[function(e,r,t){"use strict";function a(e,r,t){var o=this._refs[t];if("string"==typeof o){if(!this._refs[o])return a.call(this,e,r,o);o=this._refs[o]}if(o=o||this._schemas[t],o instanceof g)return n(o.schema,this._opts.inlineRefs)?o.schema:o.validate||this._compile(o);var i,l,c,h=s.call(this,r,t);return h&&(i=h.schema,r=h.root,c=h.baseId),i instanceof g?l=i.validate||e.call(this,i.schema,r,void 0,c):i&&(l=n(i,this._opts.inlineRefs)?i:e.call(this,i,r,void 0,c)),l}function s(e,r){var t=m.parse(r,!1,!0),a=u(t),s=h(e.schema.id);if(a!==s){var n=f(a),l=this._refs[n];if("string"==typeof l)return o.call(this,e,l,t);if(l instanceof g)l.validate||this._compile(l),e=l;else if(l=this._schemas[n],l instanceof g){if(l.validate||this._compile(l),n==f(r))return{schema:l,root:e,baseId:s};e=l}if(!e.schema)return;s=h(e.schema.id)}return i.call(this,t,s,e.schema,e)}function o(e,r,t){var a=s.call(this,e,r);if(a){var o=a.schema,n=a.baseId;return e=a.root,o.id&&(n=d(n,o.id)),i.call(this,t,n,o,e)}}function i(e,r,t,a){if(e.hash=e.hash||"","#/"==e.hash.slice(0,2)){for(var o=e.hash.split("/"),i=1;o.length>i;i++){var n=o[i];if(n){if(n=y.unescapeFragment(n),t=t[n],!t)break;if(t.id&&!P[n]&&(r=d(r,t.id)),t.$ref){var l=d(r,t.$ref),c=s.call(this,a,l);c&&(t=c.schema,a=c.root,r=c.baseId)}}}return t&&t!=a.schema?{schema:t,root:a,baseId:r}:void 0}}function n(e,r){return r===!1?!1:void 0===r||r===!0?l(e):r?c(e)<=r:void 0}function l(e){var r;if(Array.isArray(e)){for(var t=0;e.length>t;t++)if(r=e[t],"object"==typeof r&&!l(r))return!1}else for(var a in e){if("$ref"==a)return!1;if(r=e[a],"object"==typeof r&&!l(r))return!1}return!0}function c(e){var r,t=0;if(Array.isArray(e)){for(var a=0;e.length>a;a++)if(r=e[a],"object"==typeof r&&(t+=c(r)),t==1/0)return 1/0}else for(var s in e){if("$ref"==s)return 1/0;if(E[s])t++;else if(r=e[s],"object"==typeof r&&(t+=c(r)+1),t==1/0)return 1/0}return t}function h(e,r){r!==!1&&(e=f(e));var t=m.parse(e,!1,!0);return u(t)}function u(e){return(e.protocol||"")+(e.protocol?"//":"")+(e.host||"")+(e.path||"")+"#"}function f(e){return e?e.replace(b,""):""}function d(e,r){return r=f(r),m.resolve(e,r)}function p(e){function r(e,t,s){if(Array.isArray(e))for(var o=0;e.length>o;o++)r.call(this,e[o],t+"/"+o,s);else if(e&&"object"==typeof e){if("string"==typeof e.id){var i=s=s?m.resolve(s,e.id):e.id;i=f(i);var n=this._refs[i];if("string"==typeof n&&(n=this._refs[n]),n&&n.schema){if(!v(e,n.schema))throw new Error('id "'+i+'" resolves to more than one schema')}else if(i!=f(t))if("#"==i[0]){if(a[i]&&!v(e,a[i]))throw new Error('id "'+i+'" resolves to more than one schema');a[i]=e}else this._refs[i]=t}for(var l in e)r.call(this,e[l],t+"/"+y.escapeFragment(l),s)}}var t=f(e.id),a={};return r.call(this,e,h(t,!1),t),a}var m=e("url"),v=e("./equal"),y=e("./util"),g=e("./schema_obj");r.exports=a,a.normalizeId=f,a.fullPath=h,a.url=d,a.ids=p,a.inlineRef=n;var P=y.toHash(["properties","patternProperties","enum","dependencies","definitions"]),E=y.toHash(["type","format","pattern","maxLength","minLength","maxProperties","minProperties","maxItems","minItems","maximum","minimum","uniqueItems","multipleOf","required","enum"]),b=/#\/?$/},{"./equal":4,"./schema_obj":9,"./util":10,url:43}],8:[function(e,r,t){"use strict";var a=e("./_rules"),s=e("./util");r.exports=function(){var e=[{type:"number",rules:["maximum","minimum","multipleOf"]},{type:"string",rules:["maxLength","minLength","pattern","format"]},{type:"array",rules:["maxItems","minItems","uniqueItems","items"]},{type:"object",rules:["maxProperties","minProperties","required","dependencies","properties"]},{rules:["$ref","enum","not","anyOf","oneOf","allOf"]}];return e.all=["type","additionalProperties","patternProperties"],e.keywords=["additionalItems","$schema","id","title","description","default"],e.types=["number","integer","string","array","object","boolean","null"],e.forEach(function(r){r.rules=r.rules.map(function(r){return e.all.push(r),{keyword:r,code:a[r]}})}),e.keywords=s.toHash(e.all.concat(e.keywords)),e.all=s.toHash(e.all),e.types=s.toHash(e.types),e}},{"./_rules":3,"./util":10}],9:[function(e,r,t){"use strict";function a(e){s.copy(e,this)}var s=e("./util");r.exports=a},{"./util":10}],10:[function(e,r,t){"use strict";function a(e,r){r=r||{};for(var t in e)r[t]=e[t];return r}function s(e,r,t){var a=t?" !== ":" === ",s=t?" || ":" && ",o=t?"!":"",i=t?"":"!";switch(e){case"null":return r+a+"null";case"array":return o+"Array.isArray("+r+")";case"object":return"("+o+r+s+"typeof "+r+a+'"object"'+s+i+"Array.isArray("+r+"))";case"integer":return"(typeof "+r+a+'"number"'+s+i+"("+r+" % 1))";default:return"typeof "+r+a+'"'+e+'"'}}function o(e,r){switch(e.length){case 1:return s(e[0],r,!0);default:var t="",a=n(e);a.array&&a.object&&(t=a["null"]?"(":"(!"+r+" || ",t+="typeof "+r+' !== "object")',delete a["null"],delete a.array,delete a.object),a.number&&delete a.integer;for(var o in a)t+=(t?" && ":"")+s(o,r,!0);return t}}function i(e){if(Array.isArray(e)){for(var r=[],t=0;e.length>t;t++){var a=e[t];$[a]&&(r[r.length]=a)}if(r.length)return r}else if($[e])return[e]}function n(e){for(var r={},t=0;e.length>t;t++)r[e[t]]=!0;return r}function l(e){return"number"==typeof e?"["+e+"]":S.test(e)?"."+e:"['"+e.replace(_,"\\$&")+"']"}function c(e){return e.replace(_,"\\$&")}function h(e){for(var r,t=0,a=e.length,s=0;a>s;)t++,r=e.charCodeAt(s++),r>=55296&&56319>=r&&a>s&&(r=e.charCodeAt(s),56320==(64512&r)&&s++);return t}function u(e,r){r+="[^0-9]";var t=e.match(new RegExp(r,"g"));return t?t.length:0}function f(e,r,t){return r+="([^0-9])",t=t.replace(/\$/g,"$$$$"),e.replace(new RegExp(r,"g"),t+"$1")}function d(e){return e.replace(R,"").replace(O,"").replace(k,"if (!($1))")}function p(e,r){var t=e.match(A);return t&&2===t.length?r?e.replace(q,"").replace(D,V):e.replace(I,"").replace(L,C):e}function m(e,r){for(var t in e)if(r[t])return!0}function v(e){return"'"+c(e)+"'"}function y(e,r,t,a){var s=t?"'/' + "+r+(a?"":".replace(/~/g, '~0').replace(/\\//g, '~1')"):a?"'[' + "+r+" + ']'":"'[\\'' + "+r+" + '\\']'";return E(e,s)}function g(e,r,t){var a=v(t?"/"+j(r):l(r));return E(e,a)}function P(e,r,t){var a=e.match(U);if(!a)throw new Error("Invalid relative JSON-pointer: "+e);var s=+a[1],o=a[2];if("#"==o){if(s>=r)throw new Error("Cannot access property/index "+s+" levels up, current level is "+r);return t[r-s]}if(s>r)throw new Error("Cannot access data "+s+" levels up, current level is "+r);var i="data"+(r-s||"");if(!o)return i;for(var n=i,c=o.split("/"),h=0;c.length>h;h++){var u=c[h];u&&(i+=l(x(u)),n+=" && "+i)}return n}function E(e,r){return'""'==e?r:(e+" + "+r).replace(/' \+ '/g,"")}function b(e){return x(decodeURIComponent(e))}function w(e){return encodeURIComponent(j(e))}function j(e){return e.replace(/~/g,"~0").replace(/\//g,"~1")}function x(e){return e.replace(/~1/g,"/").replace(/~0/g,"~")}r.exports={copy:a,checkDataType:s,checkDataTypes:o,coerceToTypes:i,toHash:n,getProperty:l,escapeQuotes:c,ucs2length:h,varOccurences:u,varReplace:f,cleanUpCode:d,cleanUpVarErrors:p,schemaHasRules:m,stableStringify:e("json-stable-stringify"),toQuotedString:v,getPathExpr:y,getPath:g,getData:P,unescapeFragment:b,escapeFragment:w,escapeJsonPointer:j};var $=n(["string","number","integer","boolean","null"]),S=/^[a-z$_][a-z$_0-9]*$/i,_=/'|\\/g,R=/else\s*{\s*}/g,O=/if\s*\([^)]+\)\s*\{\s*\}(?!\s*else)/g,k=/if\s*\(([^)]+)\)\s*\{\s*\}\s*else(?!\s*if)/g,A=/[^v\.]errors/g,I=/var errors = 0;|var vErrors = null;|validate.errors = vErrors;/g,q=/var errors = 0;|var vErrors = null;/g,L="return errors === 0;",C="validate.errors = null; return true;",D=/if \(errors === 0\) return true;\s*else throw new ValidationError\(vErrors\);/,V="return true;",U=/^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/},{"json-stable-stringify":46}],11:[function(e,r,t){"use strict";function a(e){this.message="validation failed",this.errors=e,this.ajv=this.validation=!0}r.exports=a,a.prototype=Object.create(Error.prototype),a.prototype.constructor=a},{}],12:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s;if(a+="var "+u+" = undefined;",e.opts.format===!1)return a+=" "+u+" = true; ";var f=e.schema.format,d=e.opts.v5&&f.$data,p="";if(d){var m=e.util.getData(f.$data,o,e.dataPathArr),v="format"+s,y="compare"+s;a+=" var "+v+" = formats["+m+"] , "+y+" = "+v+" && "+v+".compare;"}else{var v=e.formats[f];if(!v||!v.compare)return a+="  "+u+" = true; ";var y="formats"+e.util.getProperty(f)+".compare"}var g="formatMaximum"==r,P="exclusiveFormat"+(g?"Maximum":"Minimum"),E=e.schema[P],b=e.opts.v5&&E&&E.$data,w=g?"<":">",j="result"+s,x=e.opts.v5&&i.$data,$=x?e.util.getData(i.$data,o,e.dataPathArr):i;if(x&&(a+=" var schema"+s+" = "+$+"; ",$="schema"+s),b){var S=e.util.getData(E.$data,o,e.dataPathArr),_="exclusive"+s,R="op"+s,O="' + "+R+" + '";a+=" var schemaExcl"+s+" = "+S+"; ",S="schemaExcl"+s,a+=" if (typeof "+S+" != 'boolean' && "+S+" !== undefined) { "+u+" = false; ";var t=P,k=k||[];k.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_exclusiveFormatLimit")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: '"+P+" should be boolean' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var A=a;a=k.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+A+"]); ":" validate.errors = ["+A+"]; return false; ":" var err = "+A+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" }  ",c&&(p+="}",a+=" else { "),x&&(a+=" if ("+$+" === undefined) "+u+" = true; else if (typeof "+$+" != 'string') "+u+" = false; else { ",p+="}"),d&&(a+=" if (!"+y+") "+u+" = true; else { ",p+="}"),a+=" var "+j+" = "+y+"("+h+",  ",a+=x?""+$:""+e.util.toQuotedString(i),a+=" ); if ("+j+" === undefined) "+u+" = false; var exclusive"+s+" = "+S+" === true; if ("+u+" === undefined) { "+u+" = exclusive"+s+" ? "+j+" "+w+" 0 : "+j+" "+w+"= 0; } if (!"+u+") var op"+s+" = exclusive"+s+" ? '"+w+"' : '"+w+"=';"}else{var _=E===!0,O=w;_||(O+="=");var R="'"+O+"'";x&&(a+=" if ("+$+" === undefined) "+u+" = true; else if (typeof "+$+" != 'string') "+u+" = false; else { ",p+="}"),d&&(a+=" if (!"+y+") "+u+" = true; else { ",p+="}"),a+=" var "+j+" = "+y+"("+h+",  ",a+=x?""+$:""+e.util.toQuotedString(i),a+=" ); if ("+j+" === undefined) "+u+" = false; if ("+u+" === undefined) "+u+" = "+j+" "+w,_||(a+="="),a+=" 0;"}a+=""+p+"if (!"+u+") { ";var t=r,k=k||[];k.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_formatLimit")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { limit:  ',a+=x?""+$:""+e.util.toQuotedString(i),a+="  } ",e.opts.messages!==!1&&(a+=" , message: 'should be "+O+' "',a+=x?"' + "+$+" + '":""+e.util.escapeQuotes(i),a+="\"' "),e.opts.verbose&&(a+=" , schema:  ",a+=x?"validate.schema"+n:""+e.util.toQuotedString(i),a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var A=a;return a=k.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+A+"]); ":" validate.errors = ["+A+"]; return false; ":" var err = "+A+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="}"}},{}],13:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s);var d="maximum"==r,p=d?"exclusiveMaximum":"exclusiveMinimum",m=e.schema[p],v=e.opts.v5&&m&&m.$data,y=d?"<":">",g=d?">":"<";if(v){var P=e.util.getData(m.$data,o,e.dataPathArr),E="exclusive"+s,b="op"+s,w="' + "+b+" + '";a+=" var schemaExcl"+s+" = "+P+"; ",P="schemaExcl"+s,a+=" var exclusive"+s+"; if (typeof "+P+" != 'boolean' && typeof "+P+" != 'undefined') { ";var t=p,j=j||[];j.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_exclusiveLimit")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: '"+p+" should be boolean' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var x=a;a=j.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+x+"]); ":" validate.errors = ["+x+"]; return false; ":" var err = "+x+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } else if( ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'number') || "),a+=" ((exclusive"+s+" = "+P+" === true) ? "+h+" "+g+"= "+f+" : "+h+" "+g+" "+f+")) { var op"+s+" = exclusive"+s+" ? '"+y+"' : '"+y+"=';"}else{var E=m===!0,w=y;E||(w+="=");var b="'"+w+"'";a+=" if ( ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'number') || "),a+=" "+h+" "+g,E&&(a+="="),a+=" "+f+") {"}var t=r,j=j||[];j.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_limit")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { comparison: '+b+", limit: "+f+", exclusive: "+E+" } ",e.opts.messages!==!1&&(a+=" , message: 'should be "+w+" ",a+=u?"' + "+f:""+i+"'"),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+i,a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var x=a;return a=j.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+x+"]); ":" validate.errors = ["+x+"]; return false; ":" var err = "+x+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } ",c&&(a+=" else { "),a}},{}],14:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s);var d="maxItems"==r?">":"<";a+="if ( ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'number') || "),a+=" "+h+".length "+d+" "+f+") { ";var t=r,p=p||[];p.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_limitItems")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { limit: '+f+" } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT have ",a+="maxItems"==r?"more":"less",a+=" than ",a+=u?"' + "+f+" + '":""+i,a+=" items' "),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+i,a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var m=a;return a=p.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+m+"]); ":" validate.errors = ["+m+"]; return false; ":" var err = "+m+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="} ",c&&(a+=" else { "),a}},{}],15:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s);var d="maxLength"==r?">":"<";a+="if ( ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'number') || "),a+=e.opts.unicode===!1?" "+h+".length ":" ucs2length("+h+") ",a+=" "+d+" "+f+") { ";var t=r,p=p||[];p.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_limitLength")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { limit: '+f+" } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT be ",a+="maxLength"==r?"longer":"shorter",a+=" than ",a+=u?"' + "+f+" + '":""+i,a+=" characters' "),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+i,a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var m=a;return a=p.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+m+"]); ":" validate.errors = ["+m+"]; return false; ":" var err = "+m+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="} ",c&&(a+=" else { "),a}},{}],16:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;
u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s);var d="maxProperties"==r?">":"<";a+="if ( ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'number') || "),a+=" Object.keys("+h+").length "+d+" "+f+") { ";var t=r,p=p||[];p.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"_limitProperties")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { limit: '+f+" } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT have ",a+="maxProperties"==r?"more":"less",a+=" than ",a+=u?"' + "+f+" + '":""+i,a+=" properties' "),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+i,a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var m=a;return a=p.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+m+"]); ":" validate.errors = ["+m+"]; return false; ":" var err = "+m+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="} ",c&&(a+=" else { "),a}},{}],17:[function(e,r,t){"use strict";r.exports=function(e,r){var t=" ",a=e.schema[r],s=e.schemaPath+"."+r,o=e.errSchemaPath+"/"+r,i=!e.opts.allErrors,n=e.util.copy(e),l="";n.level++;var c=a;if(c)for(var h,u=-1,f=c.length-1;f>u;)h=c[u+=1],e.util.schemaHasRules(h,e.RULES.all)&&(n.schema=h,n.schemaPath=s+"["+u+"]",n.errSchemaPath=o+"/"+u,t+=" "+e.validate(n)+"  ",i&&(t+=" if (valid"+n.level+") { ",l+="}"));return i&&(t+=" "+l.slice(0,-1)),t=e.util.cleanUpCode(t)}},{}],18:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f="errs__"+s,d=e.util.copy(e),p="";d.level++;var m=i.every(function(r){return e.util.schemaHasRules(r,e.RULES.all)});if(m){a+=" var "+f+" = errors; var "+u+" = false;  ";var v=e.compositeRule;e.compositeRule=d.compositeRule=!0;var y=i;if(y)for(var g,P=-1,E=y.length-1;E>P;)g=y[P+=1],d.schema=g,d.schemaPath=n+"["+P+"]",d.errSchemaPath=l+"/"+P,a+=" "+e.validate(d)+" "+u+" = "+u+" || valid"+d.level+"; if (!"+u+") { ",p+="}";e.compositeRule=d.compositeRule=v,a+=" "+p+" if (!"+u+") {  var err =   ",e.createErrors!==!1?(a+=" { keyword: '"+(t||"anyOf")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: 'should match some schema in anyOf' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ",a+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } else {  errors = "+f+"; if (vErrors !== null) { if ("+f+") vErrors.length = "+f+"; else vErrors = null; } ",e.opts.allErrors&&(a+=" } "),a=e.util.cleanUpCode(a)}else c&&(a+=" if (true) { ");return a}},{}],19:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f=e.opts.v5&&i.$data,d=f?e.util.getData(i.$data,o,e.dataPathArr):i;f&&(a+=" var schema"+s+" = "+d+"; ",d="schema"+s),f||(a+=" var schema"+s+" = validate.schema"+n+";"),a+="var "+u+" = equal("+h+", schema"+s+"); if (!"+u+") {   ";var p=p||[];p.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"constant")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: 'should be equal to constant' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var m=a;return a=p.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+m+"]); ":" validate.errors = ["+m+"]; return false; ":" var err = "+m+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" }"}},{}],20:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="errs__"+s,f=e.util.copy(e),d="";f.level++;var p={},m={};for(P in i){var v=i[P],y=Array.isArray(v)?m:p;y[P]=v}a+="var "+u+" = errors;";var g=e.errorPath;a+="var missing"+s+";";for(var P in m){y=m[P],a+=" if ("+h+e.util.getProperty(P)+" !== undefined && ( ";var E=y;if(E)for(var b,w=-1,j=E.length-1;j>w;){b=E[w+=1],w&&(a+=" || ");var x=e.util.getProperty(b);a+=" ( "+h+x+" === undefined && (missing"+s+" = "+e.util.toQuotedString(e.opts.jsonPointers?b:x)+") ) "}a+=")) {  ";var $="missing"+s,S="' + "+$+" + '";e.opts._errorDataPathProperty&&(e.errorPath=e.opts.jsonPointers?e.util.getPathExpr(g,$,!0):g+" + "+$);var _=_||[];_.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"dependencies")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { property: '"+e.util.escapeQuotes(P)+"', missingProperty: '"+S+"', depsCount: "+y.length+", deps: '"+e.util.escapeQuotes(1==y.length?y[0]:y.join(", "))+"' } ",e.opts.messages!==!1&&(a+=" , message: 'should have ",a+=1==y.length?"property "+e.util.escapeQuotes(y[0]):"properties "+e.util.escapeQuotes(y.join(", ")),a+=" when property "+e.util.escapeQuotes(P)+" is present' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var R=a;a=_.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+R+"]); ":" validate.errors = ["+R+"]; return false; ":" var err = "+R+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" }   ",c&&(d+="}",a+=" else { ")}e.errorPath=g;for(var P in p){var v=p[P];e.util.schemaHasRules(v,e.RULES.all)&&(a+=" valid"+f.level+" = true; if ("+h+"['"+P+"'] !== undefined) { ",f.schema=v,f.schemaPath=n+e.util.getProperty(P),f.errSchemaPath=l+"/"+e.util.escapeFragment(P),a+=" "+e.validate(f)+" }  ",c&&(a+=" if (valid"+f.level+") { ",d+="}"))}return c&&(a+="   "+d+" if ("+u+" == errors) {"),a=e.util.cleanUpCode(a)}},{}],21:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f=e.opts.v5&&i.$data,d=f?e.util.getData(i.$data,o,e.dataPathArr):i;f&&(a+=" var schema"+s+" = "+d+"; ",d="schema"+s);var p="i"+s;f||(a+=" var schema"+s+" = validate.schema"+n+";"),a+="var "+u+";",f&&(a+=" if (schema"+s+" === undefined) "+u+" = true; else if (!Array.isArray(schema"+s+")) "+u+" = false; else {"),a+=""+u+" = false;for (var "+p+"=0; "+p+"<schema"+s+".length; "+p+"++) if (equal("+h+", schema"+s+"["+p+"])) { "+u+" = true; break; }",f&&(a+="  }  "),a+=" if (!"+u+") {   ";var m=m||[];m.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"enum")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: 'should be equal to one of the allowed values' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var v=a;return a=m.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+v+"]); ":" validate.errors = ["+v+"]; return false; ":" var err = "+v+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" }",c&&(a+=" else { "),a}},{}],22:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||"");if(e.opts.format===!1)return c&&(a+=" if (true) { "),a;var u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;if(u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s),u){var d="format"+s;a+=" var "+d+" = formats["+f+"]; var isObject"+s+" = typeof "+d+" == 'object' && !("+d+" instanceof RegExp) && "+d+".validate; if (isObject"+s+") { var async"+s+" = "+d+".async; "+d+" = "+d+".validate; } if (  ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'string') || "),a+=" ("+d+" && !(typeof "+d+" == 'function' ? ",a+=e.async?" (async"+s+" ? "+e.yieldAwait+" "+d+"("+h+") : "+d+"("+h+")) ":" "+d+"("+h+") ",a+=" : "+d+".test("+h+")))) {"}else{var d=e.formats[i];if(!d)return c&&(a+=" if (true) { "),a;var p="object"==typeof d&&!(d instanceof RegExp)&&d.validate;if(p){var m=d.async===!0;d=d.validate}if(m){if(!e.async)throw new Error("async format in sync schema");var v="formats"+e.util.getProperty(i)+".validate";a+=" if (!("+e.yieldAwait+" "+v+"("+h+"))) { "}else{a+=" if (! ";var v="formats"+e.util.getProperty(i);p&&(v+=".validate"),a+="function"==typeof d?" "+v+"("+h+") ":" "+v+".test("+h+") ",a+=") { "}}var y=y||[];y.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"format")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { format:  ',a+=u?""+f:""+e.util.toQuotedString(i),a+="  } ",e.opts.messages!==!1&&(a+=" , message: 'should match format \"",a+=u?"' + "+f+" + '":""+e.util.escapeQuotes(i),a+="\"' "),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+e.util.toQuotedString(i),a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var g=a;return a=y.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+g+"]); ":" validate.errors = ["+g+"]; return false; ":" var err = "+g+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } ",c&&(a+=" else { "),a}},{}],23:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f="errs__"+s,d=e.util.copy(e),p="";d.level++;var m=d.dataLevel=e.dataLevel+1,v="data"+m;if(a+="var "+f+" = errors;var "+u+";",Array.isArray(i)){var y=e.schema.additionalItems;if(y===!1){a+=" "+u+" = "+h+".length <= "+i.length+"; ";var g=l;l=e.errSchemaPath+"/additionalItems",a+="  if (!"+u+") {   ";var P=P||[];P.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"additionalItems")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { limit: '+i.length+" } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT have more than "+i.length+" items' "),e.opts.verbose&&(a+=" , schema: false , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var E=a;a=P.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+E+"]); ":" validate.errors = ["+E+"]; return false; ":" var err = "+E+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } ",l=g,c&&(p+="}",a+=" else { ")}var b=i;if(b)for(var w,j=-1,x=b.length-1;x>j;)if(w=b[j+=1],e.util.schemaHasRules(w,e.RULES.all)){a+=" valid"+d.level+" = true; if ("+h+".length > "+j+") { ";var $=h+"["+j+"]";d.schema=w,d.schemaPath=n+"["+j+"]",d.errSchemaPath=l+"/"+j,d.errorPath=e.util.getPathExpr(e.errorPath,j,e.opts.jsonPointers,!0),d.dataPathArr[m]=j;var S=e.validate(d);a+=e.util.varOccurences(S,v)<2?" "+e.util.varReplace(S,v,$)+" ":" var "+v+" = "+$+"; "+S+" ",a+=" }  ",c&&(a+=" if (valid"+d.level+") { ",p+="}")}if("object"==typeof y&&e.util.schemaHasRules(y,e.RULES.all)){d.schema=y,d.schemaPath=e.schemaPath+".additionalItems",d.errSchemaPath=e.errSchemaPath+"/additionalItems",a+=" valid"+d.level+" = true; if ("+h+".length > "+i.length+") {  for (var i"+s+" = "+i.length+"; i"+s+" < "+h+".length; i"+s+"++) { ",d.errorPath=e.util.getPathExpr(e.errorPath,"i"+s,e.opts.jsonPointers,!0);var $=h+"[i"+s+"]";d.dataPathArr[m]="i"+s;var S=e.validate(d);a+=e.util.varOccurences(S,v)<2?" "+e.util.varReplace(S,v,$)+" ":" var "+v+" = "+$+"; "+S+" ",c&&(a+=" if (!valid"+d.level+") break; "),a+=" } }  ",c&&(a+=" if (valid"+d.level+") { ",p+="}")}}else if(e.util.schemaHasRules(i,e.RULES.all)){d.schema=i,d.schemaPath=n,d.errSchemaPath=l,a+="  for (var i"+s+" = 0; i"+s+" < "+h+".length; i"+s+"++) { ",d.errorPath=e.util.getPathExpr(e.errorPath,"i"+s,e.opts.jsonPointers,!0);var $=h+"[i"+s+"]";d.dataPathArr[m]="i"+s;var S=e.validate(d);a+=e.util.varOccurences(S,v)<2?" "+e.util.varReplace(S,v,$)+" ":" var "+v+" = "+$+"; "+S+" ",c&&(a+=" if (!valid"+d.level+") break; "),a+=" }  ",c&&(a+=" if (valid"+d.level+") { ",p+="}")}return c&&(a+=" "+p+" if ("+f+" == errors) {"),a=e.util.cleanUpCode(a)}},{}],24:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s),a+="var division"+s+";if (",u&&(a+=" "+f+" !== undefined && ( typeof "+f+" != 'number' || "),a+=" (division"+s+" = "+h+" / "+f+", ",a+=e.opts.multipleOfPrecision?" Math.abs(Math.round(division"+s+") - division"+s+") > 1e-"+e.opts.multipleOfPrecision+" ":" division"+s+" !== parseInt(division"+s+") ",a+=" ) ",u&&(a+="  )  "),a+=" ) {   ";var d=d||[];d.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"multipleOf")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { multipleOf: '+f+" } ",e.opts.messages!==!1&&(a+=" , message: 'should be multiple of ",a+=u?"' + "+f:""+i+"'"),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+i,a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var p=a;return a=d.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+p+"]); ":" validate.errors = ["+p+"]; return false; ":" var err = "+p+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="} ",c&&(a+=" else { "),a}},{}],25:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="errs__"+s,f=e.util.copy(e);if(f.level++,e.util.schemaHasRules(i,e.RULES.all)){f.schema=i,f.schemaPath=n,f.errSchemaPath=l,a+=" var "+u+" = errors;  ";var d=e.compositeRule;e.compositeRule=f.compositeRule=!0,f.createErrors=!1;var p;f.opts.allErrors&&(p=f.opts.allErrors,f.opts.allErrors=!1),a+=" "+e.validate(f)+" ",f.createErrors=!0,p&&(f.opts.allErrors=p),e.compositeRule=f.compositeRule=d,a+=" if (valid"+f.level+") {   ";var m=m||[];m.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"not")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: 'should NOT be valid' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var v=a;a=m.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+v+"]); ":" validate.errors = ["+v+"]; return false; ":" var err = "+v+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } else {  errors = "+u+"; if (vErrors !== null) { if ("+u+") vErrors.length = "+u+"; else vErrors = null; } ",e.opts.allErrors&&(a+=" } ")}else a+="  var err =   ",e.createErrors!==!1?(a+=" { keyword: '"+(t||"not")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: 'should NOT be valid' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ",a+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",c&&(a+=" if (false) { ");return a}},{}],26:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f="errs__"+s,d=e.util.copy(e),p="";d.level++,a+="var "+f+" = errors;var prevValid"+s+" = false;var "+u+" = false; ";var m=e.compositeRule;e.compositeRule=d.compositeRule=!0;var v=i;if(v)for(var y,g=-1,P=v.length-1;P>g;)y=v[g+=1],e.util.schemaHasRules(y,e.RULES.all)?(d.schema=y,d.schemaPath=n+"["+g+"]",d.errSchemaPath=l+"/"+g,a+=" "+e.validate(d)+" "):a+=" var valid"+d.level+" = true; ",g&&(a+=" if (valid"+d.level+" && prevValid"+s+") "+u+" = false; else { ",p+="}"),a+=" if (valid"+d.level+") "+u+" = prevValid"+s+" = true;";e.compositeRule=d.compositeRule=m,a+=""+p+"if (!"+u+") {   ";var E=E||[];E.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"oneOf")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: {} ',e.opts.messages!==!1&&(a+=" , message: 'should match exactly one schema in oneOf' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var b=a;return a=E.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+b+"]); ":" validate.errors = ["+b+"]; return false; ":" var err = "+b+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="} else {  errors = "+f+"; if (vErrors !== null) { if ("+f+") vErrors.length = "+f+"; else vErrors = null; }",e.opts.allErrors&&(a+=" } "),a}},{}],27:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u=e.opts.v5&&i.$data,f=u?e.util.getData(i.$data,o,e.dataPathArr):i;u&&(a+=" var schema"+s+" = "+f+"; ",f="schema"+s);var d=u?"(new RegExp("+f+"))":e.usePattern(i);a+="if ( ",u&&(a+=" ("+f+" !== undefined && typeof "+f+" != 'string') || "),a+=" !"+d+".test("+h+") ) {   ";var p=p||[];p.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"pattern")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { pattern:  ',a+=u?""+f:""+e.util.toQuotedString(i),a+="  } ",e.opts.messages!==!1&&(a+=" , message: 'should match pattern \"",a+=u?"' + "+f+" + '":""+e.util.escapeQuotes(i),a+="\"' "),e.opts.verbose&&(a+=" , schema:  ",a+=u?"validate.schema"+n:""+e.util.toQuotedString(i),a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var m=a;return a=p.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+m+"]); ":" validate.errors = ["+m+"]; return false; ":" var err = "+m+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+="} ",c&&(a+=" else { "),a}},{}],28:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f="key"+s,d="patternMatched"+s,p="";a+="var "+u+" = true;";var m=i;if(m)for(var v,y=-1,g=m.length-1;g>y;){v=m[y+=1],a+=" var "+d+" = false; for (var "+f+" in "+h+") { "+d+" = "+e.usePattern(v)+".test("+f+"); if ("+d+") break; } ";var P=e.util.escapeQuotes(v);a+=" if (!"+d+") { "+u+" = false;  var err =   ",e.createErrors!==!1?(a+=" { keyword: '"+(t||"patternRequired")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingPattern: '"+P+"' } ",e.opts.messages!==!1&&(a+=" , message: 'should have property matching pattern \\'"+P+"\\'' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ",a+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; }   ",c&&(p+="}",a+=" else { ")}return a+=""+p}},{}],29:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f="errs__"+s,d=e.util.copy(e),p="";d.level++;var m=d.dataLevel=e.dataLevel+1,v="data"+m,y=Object.keys(i||{}),g=e.schema.patternProperties||{},P=Object.keys(g),E=e.schema.additionalProperties,b=y.length||P.length,w=E===!1,j="object"==typeof E&&Object.keys(E).length,x=e.opts.removeAdditional,$=w||j||x,S=e.schema.required;if(S&&(!e.opts.v5||!S.$data)&&e.opts.loopRequired>S.length)var _=e.util.toHash(S);if(e.opts.v5)var R=e.schema.patternGroups||{},O=Object.keys(R);if(a+="var "+f+" = errors;var valid"+d.level+" = true;",$){if(a+=" for (var key"+s+" in "+h+") { ",b){if(a+=" var isAdditional"+s+" = !(false ",y.length)if(y.length>5)a+=" || validate.schema"+n+"[key"+s+"] ";else{var k=y;if(k)for(var A,I=-1,q=k.length-1;q>I;)A=k[I+=1],a+=" || key"+s+" == "+e.util.toQuotedString(A)+" "}if(P.length){var L=P;if(L)for(var C,D=-1,V=L.length-1;V>D;)C=L[D+=1],a+=" || "+e.usePattern(C)+".test(key"+s+") "}if(e.opts.v5&&O&&O.length){var U=O;if(U)for(var z,D=-1,T=U.length-1;T>D;)z=U[D+=1],a+=" || "+e.usePattern(z)+".test(key"+s+") "}a+=" ); if (isAdditional"+s+") { "}if("all"==x)a+=" delete "+h+"[key"+s+"]; ";else{var M=e.errorPath,N="' + key"+s+" + '";if(e.opts._errorDataPathProperty&&(e.errorPath=e.util.getPathExpr(e.errorPath,"key"+s,e.opts.jsonPointers)),w)if(x)a+=" delete "+h+"[key"+s+"]; ";else{a+=" valid"+d.level+" = false; ";var F=l;l=e.errSchemaPath+"/additionalProperties";var Q=Q||[];Q.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"additionalProperties")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { additionalProperty: '"+N+"' } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT have additional properties' "),e.opts.verbose&&(a+=" , schema: false , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var H=a;a=Q.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+H+"]); ":" validate.errors = ["+H+"]; return false; ":" var err = "+H+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",l=F,c&&(a+=" break; ")}else if(j)if("failing"==x){a+=" var "+f+" = errors;  ";var G=e.compositeRule;e.compositeRule=d.compositeRule=!0,d.schema=E,d.schemaPath=e.schemaPath+".additionalProperties",d.errSchemaPath=e.errSchemaPath+"/additionalProperties",d.errorPath=e.opts._errorDataPathProperty?e.errorPath:e.util.getPathExpr(e.errorPath,"key"+s,e.opts.jsonPointers);var J=h+"[key"+s+"]";d.dataPathArr[m]="key"+s;var K=e.validate(d);a+=e.util.varOccurences(K,v)<2?" "+e.util.varReplace(K,v,J)+" ":" var "+v+" = "+J+"; "+K+" ",a+=" if (!valid"+d.level+") { errors = "+f+"; if (validate.errors !== null) { if (errors) validate.errors.length = errors; else validate.errors = null; } delete "+h+"[key"+s+"]; }  ",e.compositeRule=d.compositeRule=G}else{d.schema=E,d.schemaPath=e.schemaPath+".additionalProperties",d.errSchemaPath=e.errSchemaPath+"/additionalProperties",d.errorPath=e.opts._errorDataPathProperty?e.errorPath:e.util.getPathExpr(e.errorPath,"key"+s,e.opts.jsonPointers);var J=h+"[key"+s+"]";d.dataPathArr[m]="key"+s;var K=e.validate(d);a+=e.util.varOccurences(K,v)<2?" "+e.util.varReplace(K,v,J)+" ":" var "+v+" = "+J+"; "+K+" ",c&&(a+=" if (!valid"+d.level+") break; ")}e.errorPath=M}b&&(a+=" } "),a+=" }  ",c&&(a+=" if (valid"+d.level+") { ",p+="}")}var B=e.opts.useDefaults&&!e.compositeRule;if(y.length){var Y=y;if(Y)for(var A,Z=-1,W=Y.length-1;W>Z;){A=Y[Z+=1];var X=i[A];if(e.util.schemaHasRules(X,e.RULES.all)){var ee=e.util.getProperty(A),J=h+ee,re=B&&void 0!==X["default"];d.schema=X,d.schemaPath=n+ee,d.errSchemaPath=l+"/"+e.util.escapeFragment(A),d.errorPath=e.util.getPath(e.errorPath,A,e.opts.jsonPointers),d.dataPathArr[m]=e.util.toQuotedString(A);var K=e.validate(d);if(e.util.varOccurences(K,v)<2){K=e.util.varReplace(K,v,J);var te=J}else{var te=v;a+=" var "+v+" = "+J+"; "}if(re)a+=" "+K+" ";else{if(_&&_[A]){a+=" if ("+te+" === undefined) { valid"+d.level+" = false; ";var M=e.errorPath,F=l,ae=e.util.escapeQuotes(A);e.opts._errorDataPathProperty&&(e.errorPath=e.util.getPath(M,A,e.opts.jsonPointers)),l=e.errSchemaPath+"/required";var Q=Q||[];Q.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"required")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingProperty: '"+ae+"' } ",e.opts.messages!==!1&&(a+=" , message: '",a+=e.opts._errorDataPathProperty?"is a required property":"should have required property \\'"+ae+"\\'",a+="' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var H=a;a=Q.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+H+"]); ":" validate.errors = ["+H+"]; return false; ":" var err = "+H+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",l=F,e.errorPath=M,a+=" } else { "}else a+=c?" if ("+te+" === undefined) { valid"+d.level+" = true; } else { ":" if ("+te+" !== undefined) { ";a+=" "+K+" } "}}c&&(a+=" if (valid"+d.level+") { ",p+="}")}}var se=P;if(se)for(var C,oe=-1,ie=se.length-1;ie>oe;){C=se[oe+=1];var X=g[C];if(e.util.schemaHasRules(X,e.RULES.all)){d.schema=X,d.schemaPath=e.schemaPath+".patternProperties"+e.util.getProperty(C),d.errSchemaPath=e.errSchemaPath+"/patternProperties/"+e.util.escapeFragment(C),a+=" for (var key"+s+" in "+h+") { if ("+e.usePattern(C)+".test(key"+s+")) { ",d.errorPath=e.util.getPathExpr(e.errorPath,"key"+s,e.opts.jsonPointers);var J=h+"[key"+s+"]";d.dataPathArr[m]="key"+s;var K=e.validate(d);a+=e.util.varOccurences(K,v)<2?" "+e.util.varReplace(K,v,J)+" ":" var "+v+" = "+J+"; "+K+" ",c&&(a+=" if (!valid"+d.level+") break; "),a+=" } ",c&&(a+=" else valid"+d.level+" = true; "),a+=" }  ",c&&(a+=" if (valid"+d.level+") { ",p+="}")}}if(e.opts.v5){var ne=O;if(ne)for(var z,le=-1,ce=ne.length-1;ce>le;){z=ne[le+=1];var he=R[z],X=he.schema;if(e.util.schemaHasRules(X,e.RULES.all)){d.schema=X,d.schemaPath=e.schemaPath+".patternGroups"+e.util.getProperty(z)+".schema",d.errSchemaPath=e.errSchemaPath+"/patternGroups/"+e.util.escapeFragment(z)+"/schema",a+=" var pgPropCount"+s+" = 0; for (var key"+s+" in "+h+") { if ("+e.usePattern(z)+".test(key"+s+")) { pgPropCount"+s+"++; ",d.errorPath=e.util.getPathExpr(e.errorPath,"key"+s,e.opts.jsonPointers);var J=h+"[key"+s+"]";d.dataPathArr[m]="key"+s;var K=e.validate(d);a+=e.util.varOccurences(K,v)<2?" "+e.util.varReplace(K,v,J)+" ":" var "+v+" = "+J+"; "+K+" ",c&&(a+=" if (!valid"+d.level+") break; "),a+=" } ",c&&(a+=" else valid"+d.level+" = true; "),a+=" }  ",c&&(a+=" if (valid"+d.level+") { ",p+="}");var ue=he.minimum,fe=he.maximum;if(void 0!==ue||void 0!==fe){a+=" var "+u+" = true; ";var F=l;if(void 0!==ue){var de=ue,pe="minimum",me="less";a+=" "+u+" = pgPropCount"+s+" >= "+ue+"; ",l=e.errSchemaPath+"/patternGroups/minimum",a+="  if (!"+u+") {   ";var Q=Q||[];Q.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"patternGroups")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { reason: '"+pe+"', limit: "+de+", pattern: '"+e.util.escapeQuotes(z)+"' } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT have "+me+" than "+de+' properties matching pattern "'+e.util.escapeQuotes(z)+"\"' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var H=a;a=Q.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+H+"]); ":" validate.errors = ["+H+"]; return false; ":" var err = "+H+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } ",void 0!==fe&&(a+=" else ")}if(void 0!==fe){var de=fe,pe="maximum",me="more";a+=" "+u+" = pgPropCount"+s+" <= "+fe+"; ",l=e.errSchemaPath+"/patternGroups/maximum",a+="  if (!"+u+") {   ";var Q=Q||[];Q.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"patternGroups")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { reason: '"+pe+"', limit: "+de+", pattern: '"+e.util.escapeQuotes(z)+"' } ",e.opts.messages!==!1&&(a+=" , message: 'should NOT have "+me+" than "+de+' properties matching pattern "'+e.util.escapeQuotes(z)+"\"' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var H=a;a=Q.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+H+"]); ":" validate.errors = ["+H+"]; return false; ":" var err = "+H+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } "}l=F,c&&(a+=" if ("+u+") { ",p+="}")}}}}return c&&(a+=" "+p+" if ("+f+" == errors) {"),a=e.util.cleanUpCode(a)}},{}],30:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a,s,o=" ",i=e.level,n=e.dataLevel,l=e.schema[r],c=e.errSchemaPath+"/"+r,h=!e.opts.allErrors,u="data"+(n||""),f="valid"+i;if("#"==l||"#/"==l)e.isRoot?(a=e.async,s="validate"):(a=e.root.schema.$async===!0,s="root.refVal[0]");else{var d=e.resolveRef(e.baseId,l,e.isRoot);if(void 0===d){var p="can't resolve reference "+l+" from id "+e.baseId;if("fail"==e.opts.missingRefs){console.log(p);var m=m||[];m.push(o),o="",e.createErrors!==!1?(o+=" { keyword: '"+(t||"$ref")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+c+"\" , params: { ref: '"+e.util.escapeQuotes(l)+"' } ",e.opts.messages!==!1&&(o+=" , message: 'can\\'t resolve reference "+e.util.escapeQuotes(l)+"' "),e.opts.verbose&&(o+=" , schema: "+e.util.toQuotedString(l)+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+u+" "),o+=" } "):o+=" {} ";var v=o;o=m.pop(),o+=!e.compositeRule&&h?e.async?" throw new ValidationError(["+v+"]); ":" validate.errors = ["+v+"]; return false; ":" var err = "+v+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",h&&(o+=" if (false) { ")}else{if("ignore"!=e.opts.missingRefs){var y=new Error(p);throw y.missingRef=e.resolve.url(e.baseId,l),y.missingSchema=e.resolve.normalizeId(e.resolve.fullPath(y.missingRef)),y}console.log(p),h&&(o+=" if (true) { ")}}else if(d.inline){var g=e.util.copy(e);g.level++,g.schema=d.schema,g.schemaPath="",g.errSchemaPath=l;var P=e.validate(g).replace(/validate\.schema/g,d.code);o+=" "+P+" ",h&&(o+=" if (valid"+g.level+") { ")}else a=d.async===!0,s=d.code}if(s){var m=m||[];m.push(o),o="",o+=e.opts.passContext?" "+s+".call(this, ":" "+s+"( ",o+=" "+u+", (dataPath || '')",'""'!=e.errorPath&&(o+=" + "+e.errorPath),o+=n?" , data"+(n-1||"")+" , "+e.dataPathArr[n]+" ":" , parentData , parentDataProperty ",o+=")  ";var E=o;if(o=m.pop(),a){if(!e.async)throw new Error("async schema referenced by sync schema");o+=" try { ",h&&(o+="var "+f+" ="),o+=" "+e.yieldAwait+" "+E+"; } catch (e) { if (!(e instanceof ValidationError)) throw e; if (vErrors === null) vErrors = e.errors; else vErrors = vErrors.concat(e.errors); errors = vErrors.length; } ",h&&(o+=" if ("+f+") { ")}else o+=" if (!"+E+") { if (vErrors === null) vErrors = "+s+".errors; else vErrors = vErrors.concat("+s+".errors); errors = vErrors.length; } ",h&&(o+=" else { ")}return o}},{}],31:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f=e.opts.v5&&i.$data,d=f?e.util.getData(i.$data,o,e.dataPathArr):i;if(f&&(a+=" var schema"+s+" = "+d+"; ",d="schema"+s),!f)if(e.opts.loopRequired>i.length&&e.schema.properties&&Object.keys(e.schema.properties).length){var p=[],m=i;if(m)for(var v,y=-1,g=m.length-1;g>y;){v=m[y+=1];var P=e.schema.properties[v];P&&e.util.schemaHasRules(P,e.RULES.all)||(p[p.length]=v)}}else var p=i;if(f||p.length){var E=e.errorPath,b=f||p.length>=e.opts.loopRequired;if(c)if(a+=" var missing"+s+"; ",b){f||(a+=" var schema"+s+" = validate.schema"+n+"; ");var w="i"+s,j="schema"+s+"["+w+"]",x="' + "+j+" + '";e.opts._errorDataPathProperty&&(e.errorPath=e.util.getPathExpr(E,j,e.opts.jsonPointers)),a+=" var "+u+" = true; ",f&&(a+=" if (schema"+s+" === undefined) "+u+" = true; else if (!Array.isArray(schema"+s+")) "+u+" = false; else {"),a+=" for (var "+w+" = 0; "+w+" < schema"+s+".length; "+w+"++) { "+u+" = "+h+"[schema"+s+"["+w+"]] !== undefined; if (!"+u+") break; } ",f&&(a+="  }  "),a+="  if (!"+u+") {   ";var $=$||[];$.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"required")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingProperty: '"+x+"' } ",
e.opts.messages!==!1&&(a+=" , message: '",a+=e.opts._errorDataPathProperty?"is a required property":"should have required property \\'"+x+"\\'",a+="' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var S=a;a=$.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+S+"]); ":" validate.errors = ["+S+"]; return false; ":" var err = "+S+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } else { "}else{a+=" if ( ";var _=p;if(_)for(var R,w=-1,O=_.length-1;O>w;){R=_[w+=1],w&&(a+=" || ");var k=e.util.getProperty(R);a+=" ( "+h+k+" === undefined && (missing"+s+" = "+e.util.toQuotedString(e.opts.jsonPointers?R:k)+") ) "}a+=") {  ";var j="missing"+s,x="' + "+j+" + '";e.opts._errorDataPathProperty&&(e.errorPath=e.opts.jsonPointers?e.util.getPathExpr(E,j,!0):E+" + "+j);var $=$||[];$.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"required")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingProperty: '"+x+"' } ",e.opts.messages!==!1&&(a+=" , message: '",a+=e.opts._errorDataPathProperty?"is a required property":"should have required property \\'"+x+"\\'",a+="' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var S=a;a=$.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+S+"]); ":" validate.errors = ["+S+"]; return false; ":" var err = "+S+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } else { "}else if(b){f||(a+=" var schema"+s+" = validate.schema"+n+"; ");var w="i"+s,j="schema"+s+"["+w+"]",x="' + "+j+" + '";e.opts._errorDataPathProperty&&(e.errorPath=e.util.getPathExpr(E,j,e.opts.jsonPointers)),f&&(a+=" if (schema"+s+" && !Array.isArray(schema"+s+")) {  var err =   ",e.createErrors!==!1?(a+=" { keyword: '"+(t||"required")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingProperty: '"+x+"' } ",e.opts.messages!==!1&&(a+=" , message: '",a+=e.opts._errorDataPathProperty?"is a required property":"should have required property \\'"+x+"\\'",a+="' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ",a+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } else if (schema"+s+" !== undefined) { "),a+=" for (var "+w+" = 0; "+w+" < schema"+s+".length; "+w+"++) { if ("+h+"[schema"+s+"["+w+"]] === undefined) {  var err =   ",e.createErrors!==!1?(a+=" { keyword: '"+(t||"required")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingProperty: '"+x+"' } ",e.opts.messages!==!1&&(a+=" , message: '",a+=e.opts._errorDataPathProperty?"is a required property":"should have required property \\'"+x+"\\'",a+="' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ",a+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } } ",f&&(a+="  }  ")}else{var A=p;if(A)for(var v,w=-1,I=A.length-1;I>w;){v=A[w+=1];var k=e.util.getProperty(v),x=e.util.escapeQuotes(v);e.opts._errorDataPathProperty&&(e.errorPath=e.util.getPath(E,v,e.opts.jsonPointers)),a+=" if ("+h+k+" === undefined) {  var err =   ",e.createErrors!==!1?(a+=" { keyword: '"+(t||"required")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+"\" , params: { missingProperty: '"+x+"' } ",e.opts.messages!==!1&&(a+=" , message: '",a+=e.opts._errorDataPathProperty?"is a required property":"should have required property \\'"+x+"\\'",a+="' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ",a+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } "}}e.errorPath=E}else c&&(a+=" if (true) {");return a}},{}],32:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f="errs__"+s,d=e.util.copy(e),p="";d.level++;var m,v="ifPassed"+e.level;a+="var "+v+";";var y=i;if(y)for(var g,P=-1,E=y.length-1;E>P;){if(g=y[P+=1],P&&!m&&(a+=" if (!"+v+") { ",p+="}"),g["if"]&&e.util.schemaHasRules(g["if"],e.RULES.all)){a+=" var "+f+" = errors;   ";var b=e.compositeRule;if(e.compositeRule=d.compositeRule=!0,d.createErrors=!1,d.schema=g["if"],d.schemaPath=n+"["+P+"].if",d.errSchemaPath=l+"/"+P+"/if",a+=" "+e.validate(d)+" ",d.createErrors=!0,e.compositeRule=d.compositeRule=b,a+=" "+v+" = valid"+d.level+"; if ("+v+") {  ","boolean"==typeof g.then){if(g.then===!1){var w=w||[];w.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"switch")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { caseIndex: '+P+" } ",e.opts.messages!==!1&&(a+=" , message: 'should pass \"switch\" keyword validation' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var j=a;a=w.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+j+"]); ":" validate.errors = ["+j+"]; return false; ":" var err = "+j+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; "}a+=" var valid"+d.level+" = "+g.then+"; "}else d.schema=g.then,d.schemaPath=n+"["+P+"].then",d.errSchemaPath=l+"/"+P+"/then",a+=" "+e.validate(d)+" ";a+="  } else {  errors = "+f+"; if (vErrors !== null) { if ("+f+") vErrors.length = "+f+"; else vErrors = null; } } "}else if(a+=" "+v+" = true;  ","boolean"==typeof g.then){if(g.then===!1){var w=w||[];w.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"switch")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { caseIndex: '+P+" } ",e.opts.messages!==!1&&(a+=" , message: 'should pass \"switch\" keyword validation' "),e.opts.verbose&&(a+=" , schema: validate.schema"+n+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var j=a;a=w.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+j+"]); ":" validate.errors = ["+j+"]; return false; ":" var err = "+j+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; "}a+=" var valid"+d.level+" = "+g.then+"; "}else d.schema=g.then,d.schemaPath=n+"["+P+"].then",d.errSchemaPath=l+"/"+P+"/then",a+=" "+e.validate(d)+" ";m=g["continue"]}return a+=""+p+"var "+u+" = valid"+d.level+"; ",a=e.util.cleanUpCode(a)}},{}],33:[function(e,r,t){"use strict";r.exports=function(e,r){var t,a=" ",s=e.level,o=e.dataLevel,i=e.schema[r],n=e.schemaPath+"."+r,l=e.errSchemaPath+"/"+r,c=!e.opts.allErrors,h="data"+(o||""),u="valid"+s,f=e.opts.v5&&i.$data,d=f?e.util.getData(i.$data,o,e.dataPathArr):i;if(f&&(a+=" var schema"+s+" = "+d+"; ",d="schema"+s),(i||f)&&e.opts.uniqueItems!==!1){f&&(a+=" var "+u+"; if ("+d+" === false || "+d+" === undefined) "+u+" = true; else if (typeof "+d+" != 'boolean') "+u+" = false; else { "),a+=" var "+u+" = true; if ("+h+".length > 1) { var i = "+h+".length, j; outer: for (;i--;) { for (j = i; j--;) { if (equal("+h+"[i], "+h+"[j])) { "+u+" = false; break outer; } } } } ",f&&(a+="  }  "),a+=" if (!"+u+") {   ";var p=p||[];p.push(a),a="",e.createErrors!==!1?(a+=" { keyword: '"+(t||"uniqueItems")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+l+'" , params: { i: i, j: j } ',e.opts.messages!==!1&&(a+=" , message: 'should NOT have duplicate items (items ## ' + j + ' and ' + i + ' are identical)' "),e.opts.verbose&&(a+=" , schema:  ",a+=f?"validate.schema"+n:""+i,a+="         , parentSchema: validate.schema"+e.schemaPath+" , data: "+h+" "),a+=" } "):a+=" {} ";var m=a;a=p.pop(),a+=!e.compositeRule&&c?e.async?" throw new ValidationError(["+m+"]); ":" validate.errors = ["+m+"]; return false; ":" var err = "+m+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",a+=" } ",c&&(a+=" else { ")}else c&&(a+=" if (true) { ");return a}},{}],34:[function(e,r,t){"use strict";r.exports=function(e,r){function t(e){for(var r=0;e.rules.length>r;r++)if(a(e.rules[r]))return!0}function a(r){return void 0!==e.schema[r.keyword]||"properties"==r.keyword&&(e.schema.additionalProperties===!1||"object"==typeof e.schema.additionalProperties||e.schema.patternProperties&&Object.keys(e.schema.patternProperties).length||e.opts.v5&&e.schema.patternGroups&&Object.keys(e.schema.patternGroups).length)}var s="",o=e.schema.$async===!0;if(e.isTop){var i=e.isTop,n=e.level=0,l=e.dataLevel=0,c="data";if(e.rootId=e.resolve.fullPath(e.root.schema.id),e.baseId=e.baseId||e.rootId,o){e.async=!0;var h="es7"==e.opts.async;e.yieldAwait=h?"await":"yield"}delete e.isTop,e.dataPathArr=[void 0],s+=" validate = ",o?h?s+=" (async function ":("co*"==e.opts.async&&(s+="co.wrap"),s+="(function* "):s+=" (function ",s+=" (data, dataPath, parentData, parentDataProperty) { 'use strict'; var vErrors = null; ",s+=" var errors = 0;     "}else{var n=e.level,l=e.dataLevel,c="data"+(l||"");if(e.schema.id&&(e.baseId=e.resolve.url(e.baseId,e.schema.id)),o&&!e.async)throw new Error("async schema in sync schema");s+=" var errs_"+n+" = errors;"}var u,f="valid"+n,d=!e.opts.allErrors,p="",m="",v=e.schema.type,y=Array.isArray(v);if(v&&e.opts.coerceTypes){var g=e.util.coerceToTypes(v);if(g){var P=e.schemaPath+".type",E=e.errSchemaPath+"/type",b=y?"checkDataTypes":"checkDataType";s+=" if ("+e.util[b](v,c,!0)+") {  ";var w="dataType"+n,j="coerced"+n;s+=" var "+w+" = typeof "+c+"; var "+j+" = undefined; ";var x="",$=g;if($)for(var S,_=-1,R=$.length-1;R>_;)S=$[_+=1],_&&(s+=" if ("+j+" === undefined) { ",x+="}"),"string"==S?s+=" if ("+w+" == 'number' || "+w+" == 'boolean') "+j+" = '' + "+c+"; else if ("+c+" === null) "+j+" = ''; ":"number"==S||"integer"==S?(s+=" if ("+w+" == 'boolean' || "+c+" === null || ("+w+" == 'string' && "+c+" && "+c+" == +"+c+" ","integer"==S&&(s+=" && !("+c+" % 1)"),s+=")) "+j+" = +"+c+"; "):"boolean"==S?s+=" if ("+c+" === 'false' || "+c+" === 0 || "+c+" === null) "+j+" = false; else if ("+c+" === 'true' || "+c+" === 1) "+j+" = true; ":"null"==S&&(s+=" if ("+c+" === '' || "+c+" === 0 || "+c+" === false) "+j+" = null; ");s+=" "+x+" if ("+j+" === undefined) {   ";var O=O||[];O.push(s),s="",e.createErrors!==!1?(s+=" { keyword: '"+(u||"type")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+E+"\" , params: { type: '",s+=y?""+v.join(","):""+v,s+="' } ",e.opts.messages!==!1&&(s+=" , message: 'should be ",s+=y?""+v.join(","):""+v,s+="' "),e.opts.verbose&&(s+=" , schema: validate.schema"+P+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+c+" "),s+=" } "):s+=" {} ";var k=s;if(s=O.pop(),s+=!e.compositeRule&&d?e.async?" throw new ValidationError(["+k+"]); ":" validate.errors = ["+k+"]; return false; ":" var err = "+k+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",s+=" } else { ",l){var A="data"+(l-1||""),I=e.dataPathArr[l];s+=" "+c+" = "+A+"["+I+"] = "+j+"; "}else s+=" data = "+j+"; if (parentData !== undefined) parentData[parentDataProperty] = "+j+"; ";s+=" } } "}}var q=e.RULES;if(q)for(var L,C=-1,D=q.length-1;D>C;)if(L=q[C+=1],t(L)){if(L.type&&(s+=" if ("+e.util.checkDataType(L.type,c)+") { "),e.opts.useDefaults&&!e.compositeRule)if("object"==L.type&&e.schema.properties){var V=e.schema.properties,U=Object.keys(V),z=U;if(z)for(var T,M=-1,N=z.length-1;N>M;){T=z[M+=1];var F=V[T];if(void 0!==F["default"]){var Q=c+e.util.getProperty(T);s+="  if ("+Q+" === undefined) "+Q+" = ",s+="clone"==e.opts.useDefaults?" "+JSON.stringify(F["default"])+" ":" "+e.useDefault(F["default"])+" ",s+="; "}}}else if("array"==L.type&&Array.isArray(e.schema.items)){var H=e.schema.items;if(H)for(var F,_=-1,G=H.length-1;G>_;)if(F=H[_+=1],void 0!==F["default"]){var Q=c+"["+_+"]";s+="  if ("+Q+" === undefined) "+Q+" = ",s+="clone"==e.opts.useDefaults?" "+JSON.stringify(F["default"])+" ":" "+e.useDefault(F["default"])+" ",s+="; "}}var J=L.rules;if(J)for(var K,B=-1,Y=J.length-1;Y>B;)if(K=J[B+=1],a(K)){if(K.custom){var V=e.schema[K.keyword],Z=e.useCustomRule(K,V,e.schema,e),W=Z.code+".errors",P=e.schemaPath+"."+K.keyword,E=e.errSchemaPath+"/"+K.keyword,X="errs"+n,_="i"+n,ee="ruleErr"+n,re=K.definition,te=re.async,ae=re.inline,se=re.macro;if(te&&!e.async)throw new Error("async keyword in sync schema");if(ae||se||(s+=""+W+" = null;"),s+="var "+X+" = errors;var valid"+n+";",ae&&re.statements)s+=" "+Z.validate;else if(se){var oe=e.util.copy(e);oe.level++,oe.schema=Z.validate,oe.schemaPath="";var ie=e.compositeRule;e.compositeRule=oe.compositeRule=!0;var ne=e.validate(oe).replace(/validate\.schema/g,Z.code);e.compositeRule=oe.compositeRule=ie,s+=" "+ne}else if(re.compile||re.validate){var O=O||[];O.push(s),s="",s+="  "+Z.code+".call( ",s+=e.opts.passContext?"this":"self";s+=re.compile||re.schema===!1?" , "+c+" ":" , validate.schema"+P+" , "+c+" , validate.schema"+e.schemaPath+" ",s+=" , (dataPath || '')",'""'!=e.errorPath&&(s+=" + "+e.errorPath),s+=l?" , data"+(l-1||"")+" , "+e.dataPathArr[l]+" ":" , parentData , parentDataProperty ",s+=" )  ";var le=s;s=O.pop(),re.errors!==!1&&(te?(W="customErrors"+n,s+=" var "+W+" = null; try { valid"+n+" = "+e.yieldAwait+le+"; } catch (e) { valid"+n+" = false; if (e instanceof ValidationError) "+W+" = e.errors; else throw e; } "):s+=" "+Z.code+".errors = null; ")}s+="if (! ",s+=ae?re.statements?" valid"+n+" ":" ("+Z.validate+") ":se?" valid"+oe.level+" ":te?re.errors===!1?" ("+e.yieldAwait+le+") ":" valid"+n+" ":" "+le+" ",s+=") { ",u=K.keyword;var O=O||[];O.push(s),s="";var O=O||[];O.push(s),s="",e.createErrors!==!1?(s+=" { keyword: '"+(u||"custom")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+E+"\" , params: { keyword: '"+K.keyword+"' } ",e.opts.messages!==!1&&(s+=" , message: 'should pass \""+K.keyword+"\" keyword validation' "),e.opts.verbose&&(s+=" , schema: validate.schema"+P+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+c+" "),s+=" } "):s+=" {} ";var k=s;s=O.pop(),s+=!e.compositeRule&&d?e.async?" throw new ValidationError(["+k+"]); ":" validate.errors = ["+k+"]; return false; ":" var err = "+k+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";var ce=s;s=O.pop(),ae?re.errors?"full"!=re.errors&&(s+="  for (var "+_+"="+X+"; "+_+"<errors; "+_+"++) { var "+ee+" = vErrors["+_+"]; if ("+ee+".dataPath === undefined) { "+ee+".dataPath = (dataPath || '') + "+e.errorPath+"; } if ("+ee+".schemaPath === undefined) { "+ee+'.schemaPath = "'+E+'"; } ',e.opts.verbose&&(s+=" "+ee+".schema = validate.schema"+P+"; "+ee+".data = "+c+"; "),s+=" } "):re.errors===!1?s+=" "+ce+" ":(s+=" if ("+X+" == errors) { "+ce+" } else {  for (var "+_+"="+X+"; "+_+"<errors; "+_+"++) { var "+ee+" = vErrors["+_+"]; if ("+ee+".dataPath === undefined) { "+ee+".dataPath = (dataPath || '') + "+e.errorPath+"; } if ("+ee+".schemaPath === undefined) { "+ee+'.schemaPath = "'+E+'"; } ',e.opts.verbose&&(s+=" "+ee+".schema = validate.schema"+P+"; "+ee+".data = "+c+"; "),s+=" } } "):se?(s+="   var err =   ",e.createErrors!==!1?(s+=" { keyword: '"+(u||"custom")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+E+"\" , params: { keyword: '"+K.keyword+"' } ",e.opts.messages!==!1&&(s+=" , message: 'should pass \""+K.keyword+"\" keyword validation' "),e.opts.verbose&&(s+=" , schema: validate.schema"+P+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+c+" "),s+=" } "):s+=" {} ",s+=";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",!e.compositeRule&&d&&(s+=e.async?" throw new ValidationError(vErrors); ":" validate.errors = vErrors; return false ")):re.errors===!1?s+=" "+ce+" ":(s+=" if (Array.isArray("+W+")) { if (vErrors === null) vErrors = "+W+"; else vErrors.concat("+W+"); errors = vErrors.length;  for (var "+_+"="+X+"; "+_+"<errors; "+_+"++) { var "+ee+" = vErrors["+_+"];  "+ee+".dataPath = (dataPath || '') + "+e.errorPath+";   "+ee+'.schemaPath = "'+E+'";  ',e.opts.verbose&&(s+=" "+ee+".schema = validate.schema"+P+"; "+ee+".data = "+c+"; "),s+=" } } else { "+ce+" } "),u=void 0,s+=" } ",d&&(s+=" else { ")}else s+=" "+K.code(e,K.keyword)+" ";d&&(p+="}")}if(d&&(s+=" "+p+" ",p=""),L.type&&(s+=" } ",v&&v===L.type)){var he=!0;s+=" else { ";var P=e.schemaPath+".type",E=e.errSchemaPath+"/type",O=O||[];O.push(s),s="",e.createErrors!==!1?(s+=" { keyword: '"+(u||"type")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+E+"\" , params: { type: '",s+=y?""+v.join(","):""+v,s+="' } ",e.opts.messages!==!1&&(s+=" , message: 'should be ",s+=y?""+v.join(","):""+v,s+="' "),e.opts.verbose&&(s+=" , schema: validate.schema"+P+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+c+" "),s+=" } "):s+=" {} ";var k=s;s=O.pop(),s+=!e.compositeRule&&d?e.async?" throw new ValidationError(["+k+"]); ":" validate.errors = ["+k+"]; return false; ":" var err = "+k+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",s+=" } "}d&&(s+=" if (errors === ",s+=i?"0":"errs_"+n,s+=") { ",m+="}")}if(v&&!he&&(!e.opts.coerceTypes||!g)){var P=e.schemaPath+".type",E=e.errSchemaPath+"/type",b=y?"checkDataTypes":"checkDataType";s+=" if ("+e.util[b](v,c,!0)+") {   ";var O=O||[];O.push(s),s="",e.createErrors!==!1?(s+=" { keyword: '"+(u||"type")+"' , dataPath: (dataPath || '') + "+e.errorPath+' , schemaPath: "'+E+"\" , params: { type: '",s+=y?""+v.join(","):""+v,s+="' } ",e.opts.messages!==!1&&(s+=" , message: 'should be ",s+=y?""+v.join(","):""+v,s+="' "),e.opts.verbose&&(s+=" , schema: validate.schema"+P+" , parentSchema: validate.schema"+e.schemaPath+" , data: "+c+" "),s+=" } "):s+=" {} ";var k=s;s=O.pop(),s+=!e.compositeRule&&d?e.async?" throw new ValidationError(["+k+"]); ":" validate.errors = ["+k+"]; return false; ":" var err = "+k+";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ",s+=" }"}return d&&(s+=" "+m+" "),i?(o?(s+=" if (errors === 0) return true;           ",s+=" else throw new ValidationError(vErrors); "):(s+=" validate.errors = vErrors; ",s+=" return errors === 0;       "),s+=" });"):s+=" var "+f+" = errors === errs_"+n+";",s=e.util.cleanUpCode(s),i&&d&&(s=e.util.cleanUpVarErrors(s,o)),s}},{}],35:[function(e,r,t){"use strict";var a=/^[a-z_$][a-z0-9_$]*$/i;r.exports=function(e,r){function t(e,r,t){for(var a,s=0;o.RULES.length>s;s++){var i=o.RULES[s];if(i.type==r){a=i;break}}a||(a={type:r,rules:[]},o.RULES.push(a));var n={keyword:e,definition:t,custom:!0};a.rules.push(n)}function s(e){if(!o.RULES.types[e])throw new Error("Unknown type "+e)}var o=this;if(this.RULES.keywords[e])throw new Error("Keyword "+e+" is already defined");if(!a.test(e))throw new Error("Keyword "+e+" is not a valid identifier");if(r){var i=r.type;if(Array.isArray(i)){var n,l=i.length;for(n=0;l>n;n++)s(i[n]);for(n=0;l>n;n++)t(e,i[n],r)}else i&&s(i),t(e,i,r)}this.RULES.keywords[e]=!0,this.RULES.all[e]=!0}},{}],36:[function(e,r,t){r.exports={id:"http://json-schema.org/draft-04/schema#",$schema:"http://json-schema.org/draft-04/schema#",description:"Core schema meta-schema",definitions:{schemaArray:{type:"array",minItems:1,items:{$ref:"#"}},positiveInteger:{type:"integer",minimum:0},positiveIntegerDefault0:{allOf:[{$ref:"#/definitions/positiveInteger"},{"default":0}]},simpleTypes:{"enum":["array","boolean","integer","null","number","object","string"]},stringArray:{type:"array",items:{type:"string"},minItems:1,uniqueItems:!0}},type:"object",properties:{id:{type:"string",format:"uri"},$schema:{type:"string",format:"uri"},title:{type:"string"},description:{type:"string"},"default":{},multipleOf:{type:"number",minimum:0,exclusiveMinimum:!0},maximum:{type:"number"},exclusiveMaximum:{type:"boolean","default":!1},minimum:{type:"number"},exclusiveMinimum:{type:"boolean","default":!1},maxLength:{$ref:"#/definitions/positiveInteger"},minLength:{$ref:"#/definitions/positiveIntegerDefault0"},pattern:{type:"string",format:"regex"},additionalItems:{anyOf:[{type:"boolean"},{$ref:"#"}],"default":{}},items:{anyOf:[{$ref:"#"},{$ref:"#/definitions/schemaArray"}],"default":{}},maxItems:{$ref:"#/definitions/positiveInteger"},minItems:{$ref:"#/definitions/positiveIntegerDefault0"},uniqueItems:{type:"boolean","default":!1},maxProperties:{$ref:"#/definitions/positiveInteger"},minProperties:{$ref:"#/definitions/positiveIntegerDefault0"},required:{$ref:"#/definitions/stringArray"},additionalProperties:{anyOf:[{type:"boolean"},{$ref:"#"}],"default":{}},definitions:{type:"object",additionalProperties:{$ref:"#"},"default":{}},properties:{type:"object",additionalProperties:{$ref:"#"},"default":{}},patternProperties:{type:"object",additionalProperties:{$ref:"#"},"default":{}},dependencies:{type:"object",additionalProperties:{anyOf:[{$ref:"#"},{$ref:"#/definitions/stringArray"}]}},"enum":{type:"array",minItems:1,uniqueItems:!0},type:{anyOf:[{$ref:"#/definitions/simpleTypes"},{type:"array",items:{$ref:"#/definitions/simpleTypes"},minItems:1,uniqueItems:!0}]},allOf:{$ref:"#/definitions/schemaArray"},anyOf:{$ref:"#/definitions/schemaArray"},oneOf:{$ref:"#/definitions/schemaArray"},not:{$ref:"#"}},dependencies:{exclusiveMaximum:["maximum"],exclusiveMinimum:["minimum"]},"default":{}}},{}],37:[function(e,r,t){r.exports={id:"https://raw.githubusercontent.com/epoberezkin/ajv/master/lib/refs/json-schema-v5.json#",$schema:"http://json-schema.org/draft-04/schema#",description:"Core schema meta-schema (v5 proposals)",definitions:{schemaArray:{type:"array",minItems:1,items:{$ref:"#"}},positiveInteger:{type:"integer",minimum:0},positiveIntegerDefault0:{allOf:[{$ref:"#/definitions/positiveInteger"},{"default":0}]},simpleTypes:{"enum":["array","boolean","integer","null","number","object","string"]},stringArray:{type:"array",items:{type:"string"},minItems:1,uniqueItems:!0},$data:{type:"object",required:["$data"],properties:{$data:{type:"string",format:"relative-json-pointer"}},additionalProperties:!1}},type:"object",properties:{id:{type:"string",format:"uri"},$schema:{type:"string",format:"uri"},title:{type:"string"},description:{type:"string"},"default":{},multipleOf:{anyOf:[{type:"number",minimum:0,exclusiveMinimum:!0},{$ref:"#/definitions/$data"}]},maximum:{anyOf:[{type:"number"},{$ref:"#/definitions/$data"}]},exclusiveMaximum:{anyOf:[{type:"boolean","default":!1},{$ref:"#/definitions/$data"}]},minimum:{anyOf:[{type:"number"},{$ref:"#/definitions/$data"}]},exclusiveMinimum:{anyOf:[{type:"boolean","default":!1},{$ref:"#/definitions/$data"}]},maxLength:{anyOf:[{$ref:"#/definitions/positiveInteger"},{$ref:"#/definitions/$data"}]},minLength:{anyOf:[{$ref:"#/definitions/positiveIntegerDefault0"},{$ref:"#/definitions/$data"}]},pattern:{anyOf:[{type:"string",format:"regex"},{$ref:"#/definitions/$data"}]},additionalItems:{anyOf:[{type:"boolean"},{$ref:"#"},{$ref:"#/definitions/$data"}],"default":{}},items:{anyOf:[{$ref:"#"},{$ref:"#/definitions/schemaArray"}],"default":{}},maxItems:{anyOf:[{$ref:"#/definitions/positiveInteger"},{$ref:"#/definitions/$data"}]},minItems:{anyOf:[{$ref:"#/definitions/positiveIntegerDefault0"},{$ref:"#/definitions/$data"}]},uniqueItems:{anyOf:[{type:"boolean","default":!1},{$ref:"#/definitions/$data"}]},maxProperties:{anyOf:[{$ref:"#/definitions/positiveInteger"},{$ref:"#/definitions/$data"}]},minProperties:{anyOf:[{$ref:"#/definitions/positiveIntegerDefault0"},{$ref:"#/definitions/$data"}]},required:{anyOf:[{$ref:"#/definitions/stringArray"},{$ref:"#/definitions/$data"}]},additionalProperties:{anyOf:[{type:"boolean"},{$ref:"#"},{$ref:"#/definitions/$data"}],"default":{}},definitions:{type:"object",additionalProperties:{$ref:"#"},"default":{}},properties:{type:"object",additionalProperties:{$ref:"#"},"default":{}},patternProperties:{type:"object",additionalProperties:{$ref:"#"},"default":{}},dependencies:{type:"object",additionalProperties:{anyOf:[{$ref:"#"},{$ref:"#/definitions/stringArray"}]}},"enum":{anyOf:[{type:"array",minItems:1,uniqueItems:!0},{$ref:"#/definitions/$data"}]},type:{anyOf:[{$ref:"#/definitions/simpleTypes"},{type:"array",items:{$ref:"#/definitions/simpleTypes"},minItems:1,uniqueItems:!0}]},allOf:{$ref:"#/definitions/schemaArray"},anyOf:{$ref:"#/definitions/schemaArray"},oneOf:{$ref:"#/definitions/schemaArray"},not:{$ref:"#"},format:{anyOf:[{type:"string"},{$ref:"#/definitions/$data"}]},formatMaximum:{anyOf:[{type:"string"},{$ref:"#/definitions/$data"}]},formatMinimum:{anyOf:[{type:"string"},{$ref:"#/definitions/$data"}]},exclusiveFormatMaximum:{anyOf:[{type:"boolean","default":!1},{$ref:"#/definitions/$data"}]},exclusiveFormatMinimum:{anyOf:[{type:"boolean","default":!1},{$ref:"#/definitions/$data"}]},constant:{anyOf:[{},{$ref:"#/definitions/$data"}]},contains:{$ref:"#"},patternGroups:{type:"object",additionalProperties:{type:"object",required:["schema"],properties:{maximum:{anyOf:[{$ref:"#/definitions/positiveInteger"},{$ref:"#/definitions/$data"}]},minimum:{anyOf:[{$ref:"#/definitions/positiveIntegerDefault0"},{$ref:"#/definitions/$data"}]},schema:{$ref:"#"}},additionalProperties:!1},"default":{}},"switch":{type:"array",items:{required:["then"],properties:{"if":{$ref:"#"},then:{anyOf:[{type:"boolean"},{$ref:"#"}]},"continue":{type:"boolean"}},additionalProperties:!1,dependencies:{"continue":["if"]}}}},dependencies:{exclusiveMaximum:["maximum"],exclusiveMinimum:["minimum"],formatMaximum:["format"],formatMinimum:["format"],exclusiveFormatMaximum:["formatMaximum"],exclusiveFormatMinimum:["formatMinimum"]},"default":{}}},{}],38:[function(e,r,t){"use strict";function a(r){function t(e,t,s){var o={inline:s||a[e],statements:!0,errors:"full"};t&&(o.type=t),r.addKeyword(e,o)}var a={"switch":e("./dotjs/switch"),constant:e("./dotjs/constant"),_formatLimit:e("./dotjs/_formatLimit"),patternRequired:e("./dotjs/patternRequired")};if(r._opts.meta!==!1){var i=e("./refs/json-schema-v5.json");r.addMetaSchema(i,o)}t("constant"),r.addKeyword("contains",{type:"array",macro:s}),t("formatMaximum","string",a._formatLimit),t("formatMinimum","string",a._formatLimit),r.addKeyword("exclusiveFormatMaximum"),r.addKeyword("exclusiveFormatMinimum"),r.addKeyword("patternGroups"),t("patternRequired","object"),t("switch")}function s(e){return{not:{items:{not:e}}}}var o="https://raw.githubusercontent.com/epoberezkin/ajv/master/lib/refs/json-schema-v5.json";r.exports={enable:a,META_SCHEMA_ID:o}},{"./dotjs/_formatLimit":12,"./dotjs/constant":19,"./dotjs/patternRequired":28,"./dotjs/switch":32,"./refs/json-schema-v5.json":37}],39:[function(e,r,t){(function(e){!function(a){function s(e){throw new RangeError(q[e])}function o(e,r){for(var t=e.length,a=[];t--;)a[t]=r(e[t]);return a}function i(e,r){var t=e.split("@"),a="";t.length>1&&(a=t[0]+"@",e=t[1]),e=e.replace(I,".");var s=e.split("."),i=o(s,r).join(".");return a+i}function n(e){for(var r,t,a=[],s=0,o=e.length;o>s;)r=e.charCodeAt(s++),r>=55296&&56319>=r&&o>s?(t=e.charCodeAt(s++),56320==(64512&t)?a.push(((1023&r)<<10)+(1023&t)+65536):(a.push(r),s--)):a.push(r);return a}function l(e){return o(e,function(e){var r="";return e>65535&&(e-=65536,r+=D(e>>>10&1023|55296),e=56320|1023&e),r+=D(e)}).join("")}function c(e){return 10>e-48?e-22:26>e-65?e-65:26>e-97?e-97:w}function h(e,r){return e+22+75*(26>e)-((0!=r)<<5)}function u(e,r,t){var a=0;for(e=t?C(e/S):e>>1,e+=C(e/r);e>L*x>>1;a+=w)e=C(e/L);return C(a+(L+1)*e/(e+$))}function f(e){var r,t,a,o,i,n,h,f,d,p,m=[],v=e.length,y=0,g=R,P=_;for(t=e.lastIndexOf(O),0>t&&(t=0),a=0;t>a;++a)e.charCodeAt(a)>=128&&s("not-basic"),m.push(e.charCodeAt(a));for(o=t>0?t+1:0;v>o;){for(i=y,n=1,h=w;o>=v&&s("invalid-input"),f=c(e.charCodeAt(o++)),(f>=w||f>C((b-y)/n))&&s("overflow"),y+=f*n,d=P>=h?j:h>=P+x?x:h-P,!(d>f);h+=w)p=w-d,n>C(b/p)&&s("overflow"),n*=p;r=m.length+1,P=u(y-i,r,0==i),C(y/r)>b-g&&s("overflow"),g+=C(y/r),y%=r,m.splice(y++,0,g)}return l(m)}function d(e){var r,t,a,o,i,l,c,f,d,p,m,v,y,g,P,E=[];for(e=n(e),v=e.length,r=R,t=0,i=_,l=0;v>l;++l)m=e[l],128>m&&E.push(D(m));for(a=o=E.length,o&&E.push(O);v>a;){for(c=b,l=0;v>l;++l)m=e[l],m>=r&&c>m&&(c=m);for(y=a+1,c-r>C((b-t)/y)&&s("overflow"),t+=(c-r)*y,r=c,l=0;v>l;++l)if(m=e[l],r>m&&++t>b&&s("overflow"),m==r){for(f=t,d=w;p=i>=d?j:d>=i+x?x:d-i,!(p>f);d+=w)P=f-p,g=w-p,E.push(D(h(p+P%g,0))),f=C(P/g);E.push(D(h(f,0))),i=u(t,y,a==o),t=0,++a}++t,++r}return E.join("")}function p(e){return i(e,function(e){return k.test(e)?f(e.slice(4).toLowerCase()):e})}function m(e){return i(e,function(e){return A.test(e)?"xn--"+d(e):e})}var v="object"==typeof t&&t&&!t.nodeType&&t,y="object"==typeof r&&r&&!r.nodeType&&r,g="object"==typeof e&&e;g.global!==g&&g.window!==g&&g.self!==g||(a=g);var P,E,b=2147483647,w=36,j=1,x=26,$=38,S=700,_=72,R=128,O="-",k=/^xn--/,A=/[^\x20-\x7E]/,I=/[\x2E\u3002\uFF0E\uFF61]/g,q={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},L=w-j,C=Math.floor,D=String.fromCharCode;if(P={version:"1.4.1",ucs2:{decode:n,encode:l},decode:f,encode:d,toASCII:m,toUnicode:p},"function"==typeof define&&"object"==typeof define.amd&&define.amd)define("punycode",function(){return P});else if(v&&y)if(r.exports==v)y.exports=P;else for(E in P)P.hasOwnProperty(E)&&(v[E]=P[E]);else a.punycode=P}(this)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],40:[function(e,r,t){"use strict";function a(e,r){return Object.prototype.hasOwnProperty.call(e,r)}r.exports=function(e,r,t,o){r=r||"&",t=t||"=";var i={};if("string"!=typeof e||0===e.length)return i;var n=/\+/g;e=e.split(r);var l=1e3;o&&"number"==typeof o.maxKeys&&(l=o.maxKeys);var c=e.length;l>0&&c>l&&(c=l);for(var h=0;c>h;++h){var u,f,d,p,m=e[h].replace(n,"%20"),v=m.indexOf(t);v>=0?(u=m.substr(0,v),f=m.substr(v+1)):(u=m,f=""),d=decodeURIComponent(u),p=decodeURIComponent(f),a(i,d)?s(i[d])?i[d].push(p):i[d]=[i[d],p]:i[d]=p}return i};var s=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)}},{}],41:[function(e,r,t){"use strict";function a(e,r){if(e.map)return e.map(r);for(var t=[],a=0;e.length>a;a++)t.push(r(e[a],a));return t}var s=function(e){switch(typeof e){case"string":return e;case"boolean":return e?"true":"false";case"number":return isFinite(e)?e:"";default:return""}};r.exports=function(e,r,t,n){return r=r||"&",t=t||"=",null===e&&(e=void 0),"object"==typeof e?a(i(e),function(i){var n=encodeURIComponent(s(i))+t;return o(e[i])?a(e[i],function(e){return n+encodeURIComponent(s(e))}).join(r):n+encodeURIComponent(s(e[i]))}).join(r):n?encodeURIComponent(s(n))+t+encodeURIComponent(s(e)):""};var o=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)},i=Object.keys||function(e){var r=[];for(var t in e)Object.prototype.hasOwnProperty.call(e,t)&&r.push(t);return r}},{}],42:[function(e,r,t){"use strict";t.decode=t.parse=e("./decode"),t.encode=t.stringify=e("./encode")},{"./decode":40,"./encode":41}],43:[function(e,r,t){"use strict";function a(){this.protocol=null,this.slashes=null,this.auth=null,this.host=null,this.port=null,this.hostname=null,this.hash=null,this.search=null,this.query=null,this.pathname=null,this.path=null,this.href=null}function s(e,r,t){if(e&&c.isObject(e)&&e instanceof a)return e;var s=new a;return s.parse(e,r,t),s}function o(e){return c.isString(e)&&(e=s(e)),e instanceof a?e.format():a.prototype.format.call(e)}function i(e,r){return s(e,!1,!0).resolve(r)}function n(e,r){return e?s(e,!1,!0).resolveObject(r):r}var l=e("punycode"),c=e("./util");t.parse=s,t.resolve=i,t.resolveObject=n,t.format=o,t.Url=a;var h=/^([a-z0-9.+-]+:)/i,u=/:[0-9]*$/,f=/^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,d=["<",">",'"',"`"," ","\r","\n","	"],p=["{","}","|","\\","^","`"].concat(d),m=["'"].concat(p),v=["%","/","?",";","#"].concat(m),y=["/","?","#"],g=255,P=/^[+a-z0-9A-Z_-]{0,63}$/,E=/^([+a-z0-9A-Z_-]{0,63})(.*)$/,b={javascript:!0,"javascript:":!0},w={javascript:!0,"javascript:":!0},j={http:!0,https:!0,
ftp:!0,gopher:!0,file:!0,"http:":!0,"https:":!0,"ftp:":!0,"gopher:":!0,"file:":!0},x=e("querystring");a.prototype.parse=function(e,r,t){if(!c.isString(e))throw new TypeError("Parameter 'url' must be a string, not "+typeof e);var a=e.indexOf("?"),s=-1!==a&&a<e.indexOf("#")?"?":"#",o=e.split(s),i=/\\/g;o[0]=o[0].replace(i,"/"),e=o.join(s);var n=e;if(n=n.trim(),!t&&1===e.split("#").length){var u=f.exec(n);if(u)return this.path=n,this.href=n,this.pathname=u[1],u[2]?(this.search=u[2],this.query=r?x.parse(this.search.substr(1)):this.search.substr(1)):r&&(this.search="",this.query={}),this}var d=h.exec(n);if(d){d=d[0];var p=d.toLowerCase();this.protocol=p,n=n.substr(d.length)}if(t||d||n.match(/^\/\/[^@\/]+@[^@\/]+/)){var $="//"===n.substr(0,2);!$||d&&w[d]||(n=n.substr(2),this.slashes=!0)}if(!w[d]&&($||d&&!j[d])){for(var S=-1,_=0;y.length>_;_++){var R=n.indexOf(y[_]);-1!==R&&(-1===S||S>R)&&(S=R)}var O,k;k=-1===S?n.lastIndexOf("@"):n.lastIndexOf("@",S),-1!==k&&(O=n.slice(0,k),n=n.slice(k+1),this.auth=decodeURIComponent(O)),S=-1;for(var _=0;v.length>_;_++){var R=n.indexOf(v[_]);-1!==R&&(-1===S||S>R)&&(S=R)}-1===S&&(S=n.length),this.host=n.slice(0,S),n=n.slice(S),this.parseHost(),this.hostname=this.hostname||"";var A="["===this.hostname[0]&&"]"===this.hostname[this.hostname.length-1];if(!A)for(var I=this.hostname.split(/\./),_=0,q=I.length;q>_;_++){var L=I[_];if(L&&!L.match(P)){for(var C="",D=0,V=L.length;V>D;D++)C+=L.charCodeAt(D)>127?"x":L[D];if(!C.match(P)){var U=I.slice(0,_),z=I.slice(_+1),T=L.match(E);T&&(U.push(T[1]),z.unshift(T[2])),z.length&&(n="/"+z.join(".")+n),this.hostname=U.join(".");break}}}this.hostname=this.hostname.length>g?"":this.hostname.toLowerCase(),A||(this.hostname=l.toASCII(this.hostname));var M=this.port?":"+this.port:"",N=this.hostname||"";this.host=N+M,this.href+=this.host,A&&(this.hostname=this.hostname.substr(1,this.hostname.length-2),"/"!==n[0]&&(n="/"+n))}if(!b[p])for(var _=0,q=m.length;q>_;_++){var F=m[_];if(-1!==n.indexOf(F)){var Q=encodeURIComponent(F);Q===F&&(Q=escape(F)),n=n.split(F).join(Q)}}var H=n.indexOf("#");-1!==H&&(this.hash=n.substr(H),n=n.slice(0,H));var G=n.indexOf("?");if(-1!==G?(this.search=n.substr(G),this.query=n.substr(G+1),r&&(this.query=x.parse(this.query)),n=n.slice(0,G)):r&&(this.search="",this.query={}),n&&(this.pathname=n),j[p]&&this.hostname&&!this.pathname&&(this.pathname="/"),this.pathname||this.search){var M=this.pathname||"",J=this.search||"";this.path=M+J}return this.href=this.format(),this},a.prototype.format=function(){var e=this.auth||"";e&&(e=encodeURIComponent(e),e=e.replace(/%3A/i,":"),e+="@");var r=this.protocol||"",t=this.pathname||"",a=this.hash||"",s=!1,o="";this.host?s=e+this.host:this.hostname&&(s=e+(-1===this.hostname.indexOf(":")?this.hostname:"["+this.hostname+"]"),this.port&&(s+=":"+this.port)),this.query&&c.isObject(this.query)&&Object.keys(this.query).length&&(o=x.stringify(this.query));var i=this.search||o&&"?"+o||"";return r&&":"!==r.substr(-1)&&(r+=":"),this.slashes||(!r||j[r])&&s!==!1?(s="//"+(s||""),t&&"/"!==t.charAt(0)&&(t="/"+t)):s||(s=""),a&&"#"!==a.charAt(0)&&(a="#"+a),i&&"?"!==i.charAt(0)&&(i="?"+i),t=t.replace(/[?#]/g,function(e){return encodeURIComponent(e)}),i=i.replace("#","%23"),r+s+t+i+a},a.prototype.resolve=function(e){return this.resolveObject(s(e,!1,!0)).format()},a.prototype.resolveObject=function(e){if(c.isString(e)){var r=new a;r.parse(e,!1,!0),e=r}for(var t=new a,s=Object.keys(this),o=0;s.length>o;o++){var i=s[o];t[i]=this[i]}if(t.hash=e.hash,""===e.href)return t.href=t.format(),t;if(e.slashes&&!e.protocol){for(var n=Object.keys(e),l=0;n.length>l;l++){var h=n[l];"protocol"!==h&&(t[h]=e[h])}return j[t.protocol]&&t.hostname&&!t.pathname&&(t.path=t.pathname="/"),t.href=t.format(),t}if(e.protocol&&e.protocol!==t.protocol){if(!j[e.protocol]){for(var u=Object.keys(e),f=0;u.length>f;f++){var d=u[f];t[d]=e[d]}return t.href=t.format(),t}if(t.protocol=e.protocol,e.host||w[e.protocol])t.pathname=e.pathname;else{for(var p=(e.pathname||"").split("/");p.length&&!(e.host=p.shift()););e.host||(e.host=""),e.hostname||(e.hostname=""),""!==p[0]&&p.unshift(""),2>p.length&&p.unshift(""),t.pathname=p.join("/")}if(t.search=e.search,t.query=e.query,t.host=e.host||"",t.auth=e.auth,t.hostname=e.hostname||e.host,t.port=e.port,t.pathname||t.search){var m=t.pathname||"",v=t.search||"";t.path=m+v}return t.slashes=t.slashes||e.slashes,t.href=t.format(),t}var y=t.pathname&&"/"===t.pathname.charAt(0),g=e.host||e.pathname&&"/"===e.pathname.charAt(0),P=g||y||t.host&&e.pathname,E=P,b=t.pathname&&t.pathname.split("/")||[],p=e.pathname&&e.pathname.split("/")||[],x=t.protocol&&!j[t.protocol];if(x&&(t.hostname="",t.port=null,t.host&&(""===b[0]?b[0]=t.host:b.unshift(t.host)),t.host="",e.protocol&&(e.hostname=null,e.port=null,e.host&&(""===p[0]?p[0]=e.host:p.unshift(e.host)),e.host=null),P=P&&(""===p[0]||""===b[0])),g)t.host=e.host||""===e.host?e.host:t.host,t.hostname=e.hostname||""===e.hostname?e.hostname:t.hostname,t.search=e.search,t.query=e.query,b=p;else if(p.length)b||(b=[]),b.pop(),b=b.concat(p),t.search=e.search,t.query=e.query;else if(!c.isNullOrUndefined(e.search)){if(x){t.hostname=t.host=b.shift();var $=t.host&&t.host.indexOf("@")>0?t.host.split("@"):!1;$&&(t.auth=$.shift(),t.host=t.hostname=$.shift())}return t.search=e.search,t.query=e.query,c.isNull(t.pathname)&&c.isNull(t.search)||(t.path=(t.pathname?t.pathname:"")+(t.search?t.search:"")),t.href=t.format(),t}if(!b.length)return t.pathname=null,t.path=t.search?"/"+t.search:null,t.href=t.format(),t;for(var S=b.slice(-1)[0],_=(t.host||e.host||b.length>1)&&("."===S||".."===S)||""===S,R=0,O=b.length;O>=0;O--)S=b[O],"."===S?b.splice(O,1):".."===S?(b.splice(O,1),R++):R&&(b.splice(O,1),R--);if(!P&&!E)for(;R--;R)b.unshift("..");!P||""===b[0]||b[0]&&"/"===b[0].charAt(0)||b.unshift(""),_&&"/"!==b.join("/").substr(-1)&&b.push("");var k=""===b[0]||b[0]&&"/"===b[0].charAt(0);if(x){t.hostname=t.host=k?"":b.length?b.shift():"";var $=t.host&&t.host.indexOf("@")>0?t.host.split("@"):!1;$&&(t.auth=$.shift(),t.host=t.hostname=$.shift())}return P=P||t.host&&b.length,P&&!k&&b.unshift(""),b.length?t.pathname=b.join("/"):(t.pathname=null,t.path=null),c.isNull(t.pathname)&&c.isNull(t.search)||(t.path=(t.pathname?t.pathname:"")+(t.search?t.search:"")),t.auth=e.auth||t.auth,t.slashes=t.slashes||e.slashes,t.href=t.format(),t},a.prototype.parseHost=function(){var e=this.host,r=u.exec(e);r&&(r=r[0],":"!==r&&(this.port=r.substr(1)),e=e.substr(0,e.length-r.length)),e&&(this.hostname=e)}},{"./util":44,punycode:39,querystring:42}],44:[function(e,r,t){"use strict";r.exports={isString:function(e){return"string"==typeof e},isObject:function(e){return"object"==typeof e&&null!==e},isNull:function(e){return null===e},isNullOrUndefined:function(e){return null==e}}},{}],45:[function(e,r,t){function a(e){var r=this,t=f.call(arguments,1);return new Promise(function(a,o){function i(r){var t;try{t=e.next(r)}catch(a){return o(a)}c(t)}function n(r){var t;try{t=e["throw"](r)}catch(a){return o(a)}c(t)}function c(e){if(e.done)return a(e.value);var t=s.call(r,e.value);return t&&l(t)?t.then(i,n):n(new TypeError('You may only yield a function, promise, generator, array, or object, but the following object was passed: "'+String(e.value)+'"'))}return"function"==typeof e&&(e=e.apply(r,t)),e&&"function"==typeof e.next?void i():a(e)})}function s(e){return e?l(e)?e:h(e)||c(e)?a.call(this,e):"function"==typeof e?o.call(this,e):Array.isArray(e)?i.call(this,e):u(e)?n.call(this,e):e:e}function o(e){var r=this;return new Promise(function(t,a){e.call(r,function(e,r){return e?a(e):(arguments.length>2&&(r=f.call(arguments,1)),void t(r))})})}function i(e){return Promise.all(e.map(s,this))}function n(e){function r(e,r){t[r]=void 0,o.push(e.then(function(e){t[r]=e}))}for(var t=new e.constructor,a=Object.keys(e),o=[],i=0;a.length>i;i++){var n=a[i],c=s.call(this,e[n]);c&&l(c)?r(c,n):t[n]=e[n]}return Promise.all(o).then(function(){return t})}function l(e){return"function"==typeof e.then}function c(e){return"function"==typeof e.next&&"function"==typeof e["throw"]}function h(e){var r=e.constructor;return r?"GeneratorFunction"===r.name||"GeneratorFunction"===r.displayName?!0:c(r.prototype):!1}function u(e){return Object==e.constructor}var f=Array.prototype.slice;r.exports=a["default"]=a.co=a,a.wrap=function(e){function r(){return a.call(this,e.apply(this,arguments))}return r.__generatorFunction__=e,r}},{}],46:[function(e,r,t){var a="undefined"!=typeof JSON?JSON:e("jsonify");r.exports=function(e,r){r||(r={}),"function"==typeof r&&(r={cmp:r});var t=r.space||"";"number"==typeof t&&(t=Array(t+1).join(" "));var i="boolean"==typeof r.cycles?r.cycles:!1,n=r.replacer||function(e,r){return r},l=r.cmp&&function(e){return function(r){return function(t,a){var s={key:t,value:r[t]},o={key:a,value:r[a]};return e(s,o)}}}(r.cmp),c=[];return function h(e,r,u,f){var d=t?"\n"+new Array(f+1).join(t):"",p=t?": ":":";if(u&&u.toJSON&&"function"==typeof u.toJSON&&(u=u.toJSON()),u=n.call(e,r,u),void 0!==u){if("object"!=typeof u||null===u)return a.stringify(u);if(s(u)){for(var m=[],v=0;u.length>v;v++){var y=h(u,v,u[v],f+1)||a.stringify(null);m.push(d+t+y)}return"["+m.join(",")+d+"]"}if(-1!==c.indexOf(u)){if(i)return a.stringify("__cycle__");throw new TypeError("Converting circular structure to JSON")}c.push(u);for(var g=o(u).sort(l&&l(u)),m=[],v=0;g.length>v;v++){var r=g[v],P=h(u,r,u[r],f+1);if(P){var E=a.stringify(r)+p+P;m.push(d+t+E)}}return c.splice(c.indexOf(u),1),"{"+m.join(",")+d+"}"}}({"":e},"",e,0)};var s=Array.isArray||function(e){return"[object Array]"==={}.toString.call(e)},o=Object.keys||function(e){var r=Object.prototype.hasOwnProperty||function(){return!0},t=[];for(var a in e)r.call(e,a)&&t.push(a);return t}},{jsonify:47}],47:[function(e,r,t){t.parse=e("./lib/parse"),t.stringify=e("./lib/stringify")},{"./lib/parse":48,"./lib/stringify":49}],48:[function(e,r,t){var a,s,o,i,n={'"':'"',"\\":"\\","/":"/",b:"\b",f:"\f",n:"\n",r:"\r",t:"	"},l=function(e){throw{name:"SyntaxError",message:e,at:a,text:o}},c=function(e){return e&&e!==s&&l("Expected '"+e+"' instead of '"+s+"'"),s=o.charAt(a),a+=1,s},h=function(){var e,r="";for("-"===s&&(r="-",c("-"));s>="0"&&"9">=s;)r+=s,c();if("."===s)for(r+=".";c()&&s>="0"&&"9">=s;)r+=s;if("e"===s||"E"===s)for(r+=s,c(),"-"!==s&&"+"!==s||(r+=s,c());s>="0"&&"9">=s;)r+=s,c();return e=+r,isFinite(e)?e:void l("Bad number")},u=function(){var e,r,t,a="";if('"'===s)for(;c();){if('"'===s)return c(),a;if("\\"===s)if(c(),"u"===s){for(t=0,r=0;4>r&&(e=parseInt(c(),16),isFinite(e));r+=1)t=16*t+e;a+=String.fromCharCode(t)}else{if("string"!=typeof n[s])break;a+=n[s]}else a+=s}l("Bad string")},f=function(){for(;s&&" ">=s;)c()},d=function(){switch(s){case"t":return c("t"),c("r"),c("u"),c("e"),!0;case"f":return c("f"),c("a"),c("l"),c("s"),c("e"),!1;case"n":return c("n"),c("u"),c("l"),c("l"),null}l("Unexpected '"+s+"'")},p=function(){var e=[];if("["===s){if(c("["),f(),"]"===s)return c("]"),e;for(;s;){if(e.push(i()),f(),"]"===s)return c("]"),e;c(","),f()}}l("Bad array")},m=function(){var e,r={};if("{"===s){if(c("{"),f(),"}"===s)return c("}"),r;for(;s;){if(e=u(),f(),c(":"),Object.hasOwnProperty.call(r,e)&&l('Duplicate key "'+e+'"'),r[e]=i(),f(),"}"===s)return c("}"),r;c(","),f()}}l("Bad object")};i=function(){switch(f(),s){case"{":return m();case"[":return p();case'"':return u();case"-":return h();default:return s>="0"&&"9">=s?h():d()}},r.exports=function(e,r){var t;return o=e,a=0,s=" ",t=i(),f(),s&&l("Syntax error"),"function"==typeof r?function n(e,t){var a,s,o=e[t];if(o&&"object"==typeof o)for(a in o)Object.prototype.hasOwnProperty.call(o,a)&&(s=n(o,a),void 0!==s?o[a]=s:delete o[a]);return r.call(e,t,o)}({"":t},""):t}},{}],49:[function(e,r,t){function a(e){return l.lastIndex=0,l.test(e)?'"'+e.replace(l,function(e){var r=c[e];return"string"==typeof r?r:"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+e+'"'}function s(e,r){var t,l,c,h,u,f=o,d=r[e];switch(d&&"object"==typeof d&&"function"==typeof d.toJSON&&(d=d.toJSON(e)),"function"==typeof n&&(d=n.call(r,e,d)),typeof d){case"string":return a(d);case"number":return isFinite(d)?String(d):"null";case"boolean":case"null":return String(d);case"object":if(!d)return"null";if(o+=i,u=[],"[object Array]"===Object.prototype.toString.apply(d)){for(h=d.length,t=0;h>t;t+=1)u[t]=s(t,d)||"null";return c=0===u.length?"[]":o?"[\n"+o+u.join(",\n"+o)+"\n"+f+"]":"["+u.join(",")+"]",o=f,c}if(n&&"object"==typeof n)for(h=n.length,t=0;h>t;t+=1)l=n[t],"string"==typeof l&&(c=s(l,d),c&&u.push(a(l)+(o?": ":":")+c));else for(l in d)Object.prototype.hasOwnProperty.call(d,l)&&(c=s(l,d),c&&u.push(a(l)+(o?": ":":")+c));return c=0===u.length?"{}":o?"{\n"+o+u.join(",\n"+o)+"\n"+f+"}":"{"+u.join(",")+"}",o=f,c}}var o,i,n,l=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,c={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"};r.exports=function(e,r,t){var a;if(o="",i="","number"==typeof t)for(a=0;t>a;a+=1)i+=" ";else"string"==typeof t&&(i=t);if(n=r,r&&"function"!=typeof r&&("object"!=typeof r||"number"!=typeof r.length))throw new Error("JSON.stringify");return s("",{"":e})}},{}],ajv:[function(e,r,t){"use strict";function a(e){return v.test(e)}function Ajv(r){function t(e,r){var t;if("string"==typeof e){if(t=j(e),!t)throw new Error('no schema with key or ref "'+e+'"')}else{var a=_(e);t=a.validate||R(a)}var s=t(r);return t.async===!0?"*"==C._opts.async?p(s):s:(C.errors=t.errors,s)}function g(e){var r=_(e);return r.validate||R(r)}function P(e,r,t,a){if(Array.isArray(e))for(var s=0;e.length>s;s++)P(e[s],void 0,t,a);else{r=o.normalizeId(r||e.id),q(r);var i=C._schemas[r]=_(e,t,!0);i.meta=a}}function E(e,r,t){P(e,r,t,!0)}function b(e,r){var s=e.$schema||C._opts.defaultMeta||w(),o=C._formats.uri;C._formats.uri="function"==typeof o?a:v;var i=t(s,e);if(C._formats.uri=o,!i&&r){var n="schema is invalid:"+O();if("log"!=C._opts.validateSchema)throw new Error(n);console.error(n)}return i}function w(){var e=C._opts.meta;return C._opts.defaultMeta="object"==typeof e?e.id||e:C._opts.v5?u.META_SCHEMA_ID:m}function j(e){var r=x(e);switch(typeof r){case"object":return r.validate||R(r);case"string":return j(r)}}function x(e){return e=o.normalizeId(e),C._schemas[e]||C._refs[e]}function $(e){switch(typeof e){case"undefined":return S(C._schemas),S(C._refs),void C._cache.clear();case"string":var r=x(e);return r&&C._cache.del(r.jsonStr),delete C._schemas[e],void delete C._refs[e];case"object":if(e instanceof RegExp)return S(C._schemas,e),void S(C._refs,e);var t=l(e);C._cache.del(t);var a=e.id;a&&(a=o.normalizeId(a),delete C._schemas[a],delete C._refs[a])}}function S(e,r){for(var t in e){var a=e[t];a.meta||r&&!r.test(t)||(C._cache.del(a.jsonStr),delete e[t])}}function _(e,r,t){if("object"!=typeof e)throw new Error("schema should be object");var a=l(e),s=C._cache.get(a);if(s)return s;t=t||C._opts.addUsedSchema!==!1;var i=o.normalizeId(e.id);i&&t&&q(i),C._opts.validateSchema===!1||r||b(e,!0);var c=o.ids.call(C,e),h=new n({id:i,schema:e,localRefs:c,jsonStr:a});return"#"!=i[0]&&t&&(C._refs[i]=h),C._cache.put(a,h),h}function R(e,r){function t(){var r=e.validate,a=r.apply(null,arguments);return t.errors=r.errors,a}if(e.compiling)return e.validate=t,t.schema=e.schema,t.errors=null,t.root=r?r:t,e.schema.$async===!0&&(t.async=!0),t;e.compiling=!0;var a;e.meta&&(a=C._opts,C._opts=C._metaOpts);var o;try{o=s.call(C,e.schema,r,e.localRefs)}finally{e.compiling=!1,e.meta&&(C._opts=a)}return e.validate=o,e.refs=o.refs,e.refVal=o.refVal,e.root=o.root,o}function O(e,r){if(e=e||C.errors,!e)return"No errors";r=r||{};for(var t=void 0===r.separator?", ":r.separator,a=void 0===r.dataVar?"data":r.dataVar,s="",o=0;e.length>o;o++){var i=e[o];i&&(s+=a+i.dataPath+" "+i.message+t)}return s.slice(0,-t.length)}function k(e,r){"string"==typeof r&&(r=new RegExp(r)),C._formats[e]=r}function A(){if(C._opts.meta!==!1){var r=e("./refs/json-schema-draft-04.json");E(r,m,!0),C._refs["http://json-schema.org/schema"]=m}var t=C._opts.schemas;if(t)if(Array.isArray(t))P(t);else for(var a in t)P(t[a],a)}function I(){for(var e in C._opts.formats){var r=C._opts.formats[e];k(e,r)}}function q(e){if(C._schemas[e]||C._refs[e])throw new Error('schema with key or id "'+e+'" already exists')}function L(){for(var e=f.copy(C._opts),r=0;y.length>r;r++)delete e[y[r]];return e}if(!(this instanceof Ajv))return new Ajv(r);var C=this;r=this._opts=f.copy(r)||{},this._schemas={},this._refs={},this._formats=c(r.format),this._cache=r.cache||new i,this._loadingSchemas={},this.RULES=h(),this.validate=t,this.compile=g,this.addSchema=P,this.addMetaSchema=E,this.validateSchema=b,this.getSchema=j,this.removeSchema=$,this.addFormat=k,this.errorsText=O,this._addSchema=_,this._compile=R,r.loopRequired=r.loopRequired||1/0,(r.async||r.transpile)&&d.setup(r),r.beautify===!0&&(r.beautify={indent_size:2}),"property"==r.errorDataPath&&(r._errorDataPathProperty=!0),this._metaOpts=L(),A(),r.formats&&I(),r.v5&&u.enable(this),"object"==typeof r.meta&&E(r.meta)}var s=e("./compile"),o=e("./compile/resolve"),i=e("./cache"),n=e("./compile/schema_obj"),l=e("json-stable-stringify"),c=e("./compile/formats"),h=e("./compile/rules"),u=e("./v5"),f=e("./compile/util"),d=e("./async"),p=e("co");r.exports=Ajv,Ajv.prototype.compileAsync=d.compile,Ajv.prototype.addKeyword=e("./keyword"),Ajv.ValidationError=e("./compile/validation_error");var m="http://json-schema.org/draft-04/schema",v=/^(?:(?:[a-z][a-z0-9+-.]*:)?\/\/)?[^\s]*$/i,y=["removeAdditional","useDefaults","coerceTypes"]},{"./async":1,"./cache":2,"./compile":6,"./compile/formats":5,"./compile/resolve":7,"./compile/rules":8,"./compile/schema_obj":9,"./compile/util":10,"./compile/validation_error":11,"./keyword":35,"./refs/json-schema-draft-04.json":36,"./v5":38,co:45,"json-stable-stringify":46}]},{},[])("ajv")});
return module.exports;
})({exports:{}}, __commonjs_global);

function StatusMap() {
    // Container for all errors
    // Map from string to list of strings
    this.errors = {};
}

// Static variable to initialize key with no error
StatusMap.NO_ERROR = '';

/**
 * Clear / initialize all temporary arrays
 */
StatusMap.prototype.clear = function () {
    this.errors = {};
};

/**
 * Add a new error to the map.
 * If the error is StatusMap.NO_ERROR the entry will be added, but the list will
 * be empty, which allows the user to get a list of valid keys if needed.
 * @param {String} key The name of the error
 * @param {String} newError The error message
 */
StatusMap.prototype.appendError = function (key, newError) {
    // Make sure the entry exists
    this.appendValid(key);
    // Add the error if it exists and is not a duplicate
    if (newError && this.errors[key].indexOf(newError) === -1) {
        this.errors[key].push(newError);
    }
};

/**
 * Add a key to indicate that an item was processed with no errors
 * @param  {String} key The item to store
 */
StatusMap.prototype.appendValid = function (key) {
    // Make sure the entry exists so we can track what keys are valid
    if (!this.errors[key]) {
        this.errors[key] = [];
    }
};

/**
 * Determine if key is valid
 * @param {String} key Where to look in the map
 * @returns {boolean} True if the key is valid, meaning no errors
 */
StatusMap.prototype.validKey = function (key) {
    return !this.errors[key] || this.errors[key].length === 0;
};

/**
 * Determine if the key is invalid
 * @param {String} key The entry to look for
 * @returns {boolean} True if the key is NOT valid, meaning has an error
 */
StatusMap.prototype.invalidKey = function (key) {
    return !this.validKey(key);
};

/**
 * Create a human readable summary of all the errors.
 * @returns {string} The summary
 */
StatusMap.prototype.invalidKeySummary = function () {
    var _this = this;
    var errors = Object.keys(this.errors).reduce(function (prev, key) {
        if (_this.invalidKey(key)) {
            prev.push(key+' ('+_this.errors[key].join(', ')+')');
        }
        return prev;
    },[]);
    return errors.join(', ');
};

//---- Singletons

// Mapping from primitive names to schema validator functions
var ajvValidators = null;

// Cache schema compiler object
var ajvSchema = null;

/**
 * Create schema compiler object
 * @private
 */
function _initSchema() {
    if (!ajvSchema) {
        ajvSchema = ajv_min({ allErrors: true });
        ajvSchema.addSchema(schemaJson, "_");
        ajvValidators = {};
    }
}

/**
 * Compile the schema for the given primitive
 * @param {String} primitive The name of the primitive
 * @returns {Function} Ajv validator function
 * @private
 */
function _findValidator(primitive) {
    _initSchema();

    // Compile the schema for this primitive if needed
    if (!ajvValidators[primitive]) {
        var schemaPrim = entities[primitive];
        if (!schemaPrim) {
            return null;
        }
        var schemaId = "#/entities/"+primitive;
        ajvValidators[primitive] = ajvSchema.compile({ $ref: "_" + schemaId });
    }
    return ajvValidators[primitive];
}

//---- Class Definition

function GeometryResults() {
    // Container for all geometry results
    this.mesh = new THREE.Object3D();

    // Map from primitive name to error string or empty string when no error
    this.primStatus = new StatusMap();

    // Array of THREE.Texture objects used for image based lighting
    this.cubeArray = null;

    this.clear();
}

/**
 * Clear / initialize all temporary arrays
 */
GeometryResults.prototype.clear = function () {
    // Buffer for prims that require a server call
    this.asyncPrims = [];

    // Buffer for combining all point objects
    this.pointPrims = [];

    // Buffer for combining all line objects
    this.linePrims = [];

    // Buffer for combining all surface objects
    this.phongPrims = [];

    // Map from geometry id to material
    // Used to detect shared materials when merging
    this._geometryMaterialMap = {};
};

/**
 * Determine if there is any geometry in the mesh object
 * @return {Boolean} True when empty
 */
GeometryResults.prototype.meshIsEmpty = function () {
    return this.mesh == null || this.mesh.children.length === 0;
};

/**
 * Get the mesh or null if it's empty.
 * @return {Object3D} The mesh container or null
 */
GeometryResults.prototype.getMesh = function () {
    if (this.meshIsEmpty()) {
        return null;
    } else {
        return this.mesh;
    }
};

/**
 * Check if the entities match the parasolid entity schema
 * @param {Array} entity Array of arrays or entities
 * @param {GeometryResults} geomResult Object container for errors
 * @returns {boolean} True if the schema checked out
 * @private
 */
GeometryResults.prototype.checkSchema = function (entity) {
    if (entity.primitive) {
        if (NON_STANDARD_ENTITIES.indexOf(entity.primitive) !== -1) {
            return true;
        }
        var validate = _findValidator(entity.primitive);
        // Warning this assumes validate is synchronous so that we can
        // call validate on a singleton, and read the results safely from it's properties
        if (!validate) {
            this.primStatus.appendError(entity.primitive,"Unknown primitive type.");
            return false;
        }
        if (!validate(entity)) {
            this.primStatus.appendError(entity.primitive, _serializeErrors(validate.errors));
            return false;
        }
        return true;
    } else {
        return false;
    }
};

/**
 * Turn ajv errors into strings of their messages
 * @param {Array} errors Ajv error objects
 * @returns {string} Error message
 * @private
 */
function _serializeErrors(errors) {
    var messages = [];
    for (var i=0; i<errors.length; i++) {
        var error = errors[i];
        var message = '';
        if (error.dataPath) {
            message += error.dataPath+': ';
        }
        message += error.message;
        if ( Object.keys(error.params).length > 0) {
            var param = error.params[Object.keys(error.params)[0]];
            if (message.toLowerCase().indexOf(param) === -1) {
                message += ' ['+error.params[Object.keys(error.params)[0]]+']';
            }
        }
        messages.push(message);
    }
    return messages.join(', ');
}

/**
 * Helper function to run a callback on each entity in the nested array
 * @param {Array} arr Array of arrays or entities
 * @param {Function} cb Callbck function returning boolean
 * @returns {boolean} Reduced return value of the callback
 * @private
 */
function _recursiveReduce (arr, cb) {
    if (!arr) return false;
    var isValid = false;
    if (arr.primitive) {
        isValid = cb(arr);
    } else if (arr.constructor === Array) {
        isValid = arr.reduce(function(prev, curr) {
            return prev || _recursiveReduce(curr, cb);
        }, false);
    }
    return isValid;
}
/**
 * Determine if the given data contains geometry.
 *
 * It must only contain geometry, and arrays of geometry, no mixed types.
 *
 * @param  {Object}  data Flux JSON formatted object.
 * @return {Boolean}      Whether the data is geometry.
 */
function isKnownGeom (data) {
    var prims = listValidPrims();
    return _recursiveReduce(data, function (item) {
        return prims.indexOf(item.primitive) !== -1;
    });
}

/**
 * Determine if the given data contains materials with roughness.
 *
 * Then it is necessary to load the related textures
 *
 * @param  {Object}  entities Flux JSON formatted object.
 * @return {Boolean}      Whether the materials have roughness.
 */
function hasRoughness(entities) {
    return _recursiveReduce(entities, function (item) {
        return _getEntityData(item, 'roughness', undefined) != null;
    });
}
/**
 * Creates THREE scene and geometries from parasolid output.
 * The method is called recursively for each array and entities
 * map
 *
 * @function createObject
 *
 * @param { Object }  data        Parasolid Data from the flux json representation
 * @param { Object } geomResult Object containing properties for categorizing primitives
 */
function createObject ( data, geomResult ) {

    if (!geomResult || geomResult.constructor !== GeometryResults) {
        throw new Error('Second argument must have class GeometryResults');
    }

    if (data && Object.keys(data).length > 0) {
        geomResult.clear();
        _flattenData(data, geomResult);
        _createObject(geomResult);
    }
}

/**
 * Resolve the nested arrays of primitives into categorized flat arrays of primitives.
 * @param {Object} data The entities objects / arrays
 * @param {GeometryResult} geomResult The results container
 * @private
 */
function _flattenData(data, geomResult) {
    if (!data) return;

    // Breps are skipped when they need to be handled async
    if (data.primitive === 'brep' && (data.faces == null || data.vertices == null)) {
        geomResult.asyncPrims.push(data);
    } else if (data.primitive) {
        if (data.primitive === 'polycurve') {
            Array.prototype.push.apply(geomResult.linePrims,data.curves);
        } else if (data.primitive === 'polysurface') {
            Array.prototype.push.apply(geomResult.phongPrims,data.surfaces);
        } else {
            var type = resolveType(data.primitive).material;
            switch (type) {
                case MATERIAL_TYPES.POINT: {
                    geomResult.pointPrims.push(data);
                    break;
                }
                case MATERIAL_TYPES.LINE: {
                    geomResult.linePrims.push(data);
                    break;
                }
                case MATERIAL_TYPES.PHONG: {
                    geomResult.phongPrims.push(data);
                    break;
                }
            }
        }
    }
    if (data.constructor === Array) {
        for (var i=0;i<data.length;i++) {
            _flattenData(data[i], geomResult);
        }
    }
}
/**
 * Create the objects for each geometry type.
 * @param {GeometryResult} geomResult The results container
 * @private
 */
function _createObject ( geomResult ) {
    _handlePoints(geomResult);
    _handleLines(geomResult);
    _handlePhongs(geomResult);
}

/**
 * Create all point objects into point clouds.
 * @param {GeometryResult} geomResult The results container
 * @private
 */
function _handlePoints(geomResult) {
    var prims = geomResult.pointPrims;
    if (prims.length === 0) return;

    var validPoints = true;
    for (var i=0;i<prims.length; i++) {
        if (!geomResult.checkSchema(prims[i])) {
            validPoints = false;
        }
    }
    if (validPoints) {
        var mesh = createPoints(prims);
        geomResult.primStatus.appendValid('point');
        geomResult.mesh.add(mesh);
    }

}

/**
 * Create all the lines primitives.
 * @param {GeometryResult} geomResult The results container
 * @private
 */
function _handleLines(geomResult) {
    var prims = geomResult.linePrims;
    if (prims.length === 0) return;
    _handlePrimitives(prims, geomResult);
}

/**
 * Create all geometry that will be phong shaded.
 * @param {GeometryResult} geomResult The results container
 * @private
 */
function _handlePhongs(geomResult) {
    var prims = geomResult.phongPrims;
    if (prims.length === 0) return;
    _handlePrimitives(prims, geomResult);
}

/**
 * Create all the primitives from a list
 *
 * @param { Object } prims Entity parameter data
 * @param {GeometryResult} geomResult The results container
 */
function _handlePrimitives( prims, geomResult ) {
    var primMeshes = [];
    var i;

    // create
    for (i=0;i<prims.length;i++) {
        var mesh = _tryCreatePrimitive( prims[i], geomResult);
        if (mesh) {
            primMeshes.push(mesh);
        }
    }

    //sort
    primMeshes.sort(function (a, b) {
        // Leave non meshes at the front of the list.
        if (!a.material) {
            return -1;
        }
        if (!b.material) {
            return 1;
        }
        return a.material.name > b.material.name;
    });

    //merge
    for (i=0;i<primMeshes.length;i++) {
        _maybeMergeModels(primMeshes[i], geomResult);
    }

    if (geomResult.mesh) _upgradeChildrenToBuffer(geomResult.mesh);
}

/**
 * Call create primitive and handle errors due to bad inputs
 * @param {Object} data Primitive properties
 * @param {GeometryResults} geomResult The results object for shared data
 * @returns {THREE.Object3D} The created primitive or falsey
 * @private
 */
function _tryCreatePrimitive(data, geomResult) {
    var mesh;
    var errorMessage = StatusMap.NO_ERROR;
    try {
        mesh = createPrimitive( data, geomResult );
    }
    catch(err) {
        if (err.name !== "FluxGeometryError") {
            throw err;
        } else {
            errorMessage = err.message;
        }
    }
    // Get the error message that exists, and add to it if it exists, or set it
    geomResult.primStatus.appendError(data.primitive, errorMessage);
    return mesh;
}

/**
 * Helper function to merge the children of a particular
 * object in the scene graph into the fewest number of children
 * possible.
 *
 * @function _mergeModels
 * @private
 *
 * @param { ThreeJS.Mesh } mesh A three js mesh
 * @param { Object }       geomResult The object being built
 */
function _maybeMergeModels ( mesh, geomResult ) {
    if ( !geomResult.mesh ) geomResult.mesh = new THREE.Object3D();

    if (!mesh) return;
    mesh.updateMatrixWorld(true);
    var merged = false;
    if (_objectCanMerge(mesh)) {

        var children = geomResult.mesh.children;
        var index = children.length-1;
        var baseMesh = children[index];

        if ( _objectCanMerge( baseMesh)) {
            // Let's move the geometry from mesh to base mesh
            baseMesh.updateMatrixWorld();
            // Remember matrix multiplication applies in reverse
            var matXform = new THREE.Matrix4();
            // Apply the inverse of baseMesh transform to put the vertices from world space into it's local space
            matXform.getInverse(baseMesh.matrixWorld);
            // Apply the mesh transform to get verts from mesh in world space
            matXform.multiply(mesh.matrixWorld);
            merged = _conditionalMerge(baseMesh.geometry, mesh.geometry, matXform, geomResult._geometryMaterialMap);
        }
    }
    if (merged) {
        mesh.geometry.dispose();
    } else {
        geomResult.mesh.add(mesh);
    }
}
/**
 * Determine if two geometries have the same configuration of face vertex uvs
 * Used to determine if the geometry can merge.
 * Three.js throws warnings when converting to buffer geometry if they are mismatched.
 * @param {THREE.Geometry} geomA The first geometry
 * @param {THREE.Geometry} geomB The second geometry
 * @returns {boolean} True if they match
 * @private
 */
function _sameFaceVertexUvs(geomA, geomB) {
    var hasFaceVertexUvA = geomA.faceVertexUvs[ 0 ] && geomA.faceVertexUvs[ 0 ].length > 0;
    var hasFaceVertexUv2A = geomA.faceVertexUvs[ 1 ] && geomA.faceVertexUvs[ 1 ].length > 0;
    var hasFaceVertexUvB = geomB.faceVertexUvs[ 0 ] && geomB.faceVertexUvs[ 0 ].length > 0;
    var hasFaceVertexUv2B = geomB.faceVertexUvs[ 1 ] && geomB.faceVertexUvs[ 1 ].length > 0;
    return hasFaceVertexUvA === hasFaceVertexUvB && hasFaceVertexUv2A === hasFaceVertexUv2B;
}

function _conditionalMerge(geom1, geom2, mat, geomMap) {

    var merged = false;
    //Compare string identifiers for materials to see if they are equivalent
    if (geomMap[geom1.id] === geomMap[geom2.id] && _sameFaceVertexUvs(geom1, geom2)) {
        geom1.merge( geom2, mat );
        merged = true;
    }
    return merged;
}

/**
 * Determines if an object can merge.
 *
 * Currently only meshes can be merged.
 *
 * @function _objectCanMerge
 * @private
 *
 * @returns { Boolean } Whether the object is a mesh that can be combined with others
 *
 * @param { ThreeJS.Object3D } object The object to check
 */
function _objectCanMerge ( object ) {
    return object && object.geometry && object.type === 'Mesh' &&
           !( object.geometry instanceof THREE.BufferGeometry ) ;
}

/**
 * Takes a mesh and determines whether it can be be converted to buffer geometry.
 *
 *  Currently only meshes can be converted to buffers.
 *
 * @function _objectCanBuffer
 * @private
 *
 * @returns { Boolean } Whether the object can become BufferGeometry
 *
 * @param { ThreeJS.Object3D } object The object to check
 */
function _objectCanBuffer ( object ) {
    return object.geometry && !( object.geometry instanceof THREE.BufferGeometry ) && object.type === 'Mesh';
}



/**
 * Takes a Three js object and upgrades its children
 * to buffer geometries if possible
 *
 * @function _upgradeChildrenToBuffer
 * @private
 *
 * @param { ThreeJS.Object3D } object Object to upgrade the children of
 */
function _upgradeChildrenToBuffer ( object ) {

    var child;

    for ( var i = 0, len = object.children.length ; i < len ; i++ ) {
        child = object.children[ i ];
        if ( _objectCanBuffer( child ) ) _upgradeGeometryToBuffer( child );
    }

}



/**
 * Upgrades an object to a buffer geometry
 *
 * @function _upgradeGeometryToBuffer
 * @private
 *
 * @param { ThreeJS.Object3D } object Object to upgrade
 */
function _upgradeGeometryToBuffer ( object ) {
    var oldGeom = object.geometry;
    object.geometry = new THREE.BufferGeometry().fromGeometry( oldGeom );
    oldGeom.dispose();
}

exports.createObject = createObject;
exports.isKnownGeom = isKnownGeom;
exports.hasRoughness = hasRoughness;
exports.GeometryResults = GeometryResults;