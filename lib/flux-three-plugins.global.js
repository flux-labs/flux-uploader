(function (THREE) { 'use strict';

        THREE = 'default' in THREE ? THREE['default'] : THREE;

        THREE.AxisHelper = function ( size, labelSize ) {

            THREE.Object3D.call( this );

            size = size || 1;
            labelSize = labelSize || 16;

            var vertices = new Float32Array( [
                0, 0, 0,  size, 0, 0,
                0, 0, 0,  0, size, 0,
                0, 0, 0,  0, 0, size
            ] );

            var colors = new Float32Array( [
                1, 0, 0,  1, 0, 0,
                0, 1, 0,  0, 1, 0,
                0, 0, 1,  0, 0, 1
            ] );

            var geometry = new THREE.BufferGeometry();
            geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
            geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

            var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );

            var axes = new THREE.LineSegments( geometry, material );
            this.add( axes );

            var red = new THREE.Color( 0xff0000 );
            var labelX = new THREE.LabelHelper( 'x', labelSize, red );
            labelX.position.set( size, 0, 0 );
            axes.add( labelX );

            var green = new THREE.Color( 0x00ff00 );
            var labelY = new THREE.LabelHelper( 'y', labelSize, green);
            labelY.position.set( 0, size, 0 );
            axes.add( labelY );

            var blue = new THREE.Color( 0x0000ff );
            var labelZ = new THREE.LabelHelper( 'z', labelSize, blue );
            labelZ.position.set( 0, 0, size );
            axes.add( labelZ );

        };

        THREE.AxisHelper.prototype = Object.create( THREE.Object3D.prototype );
        THREE.AxisHelper.prototype.constructor = THREE.AxisHelper;

        // TODO(aki): allow longer labels. Only one letter currently supported

        THREE.LabelHelper = function ( label, size, color ) {
            if (!color) {
                color = new THREE.Color( 0xff0000 );
            }
            var canvas, geometry, ctx, texture, material;

            geometry = new THREE.Geometry();
            geometry.vertices.push( new THREE.Vector3() );

            canvas = document.createElement( 'canvas' );
            canvas.width = size;
            canvas.height = size;

            ctx = canvas.getContext( '2d' );
            ctx.font = size + 'px sans-serif';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText( label, size / 2, size / 2 );

            texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            texture.premultiplyAlpha = true;
            texture.generateMipmaps = false;
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            if (canvas.width) {
                material = new THREE.PointsMaterial(
                    { size: size, sizeAttenuation: false, map: texture, transparent: true, color: color } );
            }
            else {
                material = new THREE.PointsMaterial( { transparent: true, color: color } );
            }
            material.blendSrc = THREE.OneFactor;
            material.blending = THREE.CustomBlending;

            THREE.Points.call( this, geometry, material );
        };

        THREE.LabelHelper.prototype = Object.create( THREE.Points.prototype );
        THREE.LabelHelper.prototype.constructor = THREE.LabelHelper;

        THREE.TextHelper = function ( label, options ) {

            options = options || {};
            options.size = options.size || 4;
            options.resolution = options.resolution || 128;
            options.color = options.color || 'white';
            options.align = options.align || 'center';

            var canvas = document.createElement( 'canvas' );

            var ctx = canvas.getContext( '2d' );
            ctx.font = options.resolution + 'px sans-serif';

            var aspect = ctx.measureText(label).width / options.resolution;

            canvas.width = options.resolution * aspect;
            canvas.height = options.resolution;

            ctx.font = options.resolution + 'px sans-serif';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText( label, options.resolution * aspect / 2, options.resolution / 2 );

            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            texture.premultiplyAlpha = true;
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            var material = new THREE.MeshBasicMaterial( { map: texture, transparent: true, color: options.color, side: THREE.DoubleSide } );
            material.blendSrc = THREE.OneFactor;
            material.blending = THREE.CustomBlending;
            material.depthWrite = false;

            var indices = new Uint16Array( [ 0, 1, 2,  0, 2, 3 ] );
            var vertices = new Float32Array( [ - 0.5, - 0.5, 0,   0.5, - 0.5, 0,   0.5, 0.5, 0,   - 0.5, 0.5, 0 ] );
            var uvs = new Float32Array( [ 0, 0,   1, 0,   1, 1,   0, 1 ] );

            var geometry = new THREE.BufferGeometry();
            geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );
            geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
            geometry.addAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );

            THREE.Mesh.call( this, geometry, material );

            this.type = 'textHelper';

            if (options.align == 'left') {

                this.position.x = - options.size * aspect / 2;

            } else if (options.align == 'right') {

                this.position.x = options.size * aspect / 2;

            }

            this.scale.set( options.size * aspect, options.size, 1 );
            this.updateMatrix();
            this.geometry.applyMatrix(this.matrix);

            this.scale.set( 1, 1, 1 );
            this.position.set( 0, 0, 0 );
            this.updateMatrix();

        };

        THREE.TextHelper.prototype = Object.create( THREE.Mesh.prototype );
        THREE.TextHelper.prototype.constructor = THREE.TextHelper;

        /**************************************************************
         *	NURBS curve
         *	knots Array of reals
         *	controlPoints Array of Vector(2|3|4)
         **************************************************************/

        THREE.NURBSCurve = function ( degree, knots, controlPoints ) {

        	this.degree = degree;
        	this.knots = knots;
        	this.controlPoints = [];
        	for (var i = 0; i < controlPoints.length; ++ i) { // ensure Vector4 for control points
        		var point = controlPoints[i];
        		this.controlPoints[i] = new THREE.Vector4(point.x, point.y, point.z, point.w);
        	}
        	// Closed curves force their first span to be a single point. Since a
        	// span consists of a number of knots equal to the degree, we must skip
        	// the first knots to avoid extrapolation artifacts for parametric values
        	// outside the domain of the curve. iMin and iMax are integer Numbers that
        	// store the beginning and ending index which contain the renderable
        	// domain of the curve.
        	this.iMin = 0;
        	this.iMax = this.knots.length-1;
        	if (this.isClosed()) {
        		this.iMin = this.degree;
        		this.iMax = this.knots.length-1-this.degree;
        	}
        };


        THREE.NURBSCurve.prototype = Object.create( THREE.Curve.prototype );
        THREE.NURBSCurve.prototype.constructor = THREE.NURBSCurve;

        THREE.NURBSCurve.prototype.isClosed = function ( ) {
        	var start = this._getPointByParameter(this.knots[this.degree]);
        	var end = this._getPointByParameter(this.knots[this.knots.length-1-this.degree]);
        	start.sub(end);
        	var TOLERANCE = 0.000001;
        	return start.length() < TOLERANCE;
        };

        THREE.NURBSCurve.prototype.getPoint = function ( t ) {
        	var u = this.knots[this.iMin] + t * (this.knots[this.iMax] - this.knots[this.iMin]); // linear mapping t->u
        	return this._getPointByParameter(u);
        };

        THREE.NURBSCurve.prototype._getPointByParameter = function ( u ) {

        	// following results in (wx, wy, wz, w) homogeneous point
        	var hpoint = THREE.NURBSUtils.calcBSplinePoint(this.degree, this.knots, this.controlPoints, u);

        	if (hpoint.w != 1.0) { // project to 3D space: (wx, wy, wz, w) -> (x, y, z, 1)
        		hpoint.divideScalar(hpoint.w);
        	}

        	return new THREE.Vector3(hpoint.x, hpoint.y, hpoint.z);
        };


        THREE.NURBSCurve.prototype.getTangent = function ( t ) {

        	var u = this.knots[0] + t * (this.knots[this.knots.length - 1] - this.knots[0]);
        	var ders = THREE.NURBSUtils.calcNURBSDerivatives(this.degree, this.knots, this.controlPoints, u, 1);
        	var tangent = ders[1].clone();
        	tangent.normalize();

        	return tangent;
        };

        /**************************************************************
         *	NURBS surface
         *	knots2 Arrays of reals
         *	controlPoints array^2 of Vector(2|3|4)
         **************************************************************/

        THREE.NURBSSurface = function ( degree1, degree2, knots1, knots2 , controlPoints ) {
        	this.degree1 = degree1;
        	this.degree2 = degree2;
        	this.knots1 = knots1;
        	this.knots2 = knots2;
        	this.controlPoints = [];

        	var len1 = knots1.length - degree1 - 1;
        	var len2 = knots2.length - degree2 - 1;

        	// ensure Vector4 for control points
        	for (var i = 0; i < len1; ++ i) {
        		this.controlPoints[i] = [];
        		for (var j = 0; j < len2; ++ j) {
        			var point = controlPoints[i][j];
        			this.controlPoints[i][j] = new THREE.Vector4(point.x, point.y, point.z, point.w);
        		}
        	}
        	// Closed surfaces force their first span to be a single point. Since a
        	// span consists of a number of knots equal to the degree, we must skip
        	// the first knots to avoid extrapolation artifacts for parametric values
        	// outside the domain of the curve. iMin and iMax are integer Numbers that
        	// store the beginning and ending index which contain the renderable
        	// domain of the curve.
        	this.iMin1 = 0;
        	this.iMax1 = this.knots1.length-1;
        	if (this.isClosed(this.knots1, this.degree1)) {
        		this.iMin1 = this.degree1;
        		this.iMax1 = this.knots1.length-1-this.degree1;
        	}
        	this.iMin2 = 0;
        	this.iMax2 = this.knots2.length-1;
        	if (this.isClosed(this.knots2, this.degree2)) {
        		this.iMin2 = this.degree2;
        		this.iMax2 = this.knots2.length-1-this.degree2;
        	}
        };

        THREE.NURBSSurface.prototype.isClosed = function ( knots, degree ) {
        	var start1 = this._getPointByParameters(knots[degree][0]);
        	var end1 = this._getPointByParameters(knots[knots.length-1-degree][0]);
        	start1.sub(end1);
        	var TOLERANCE = 0.000001;
        	return start1.length() < TOLERANCE;
        },

        THREE.NURBSSurface.prototype.getPoint = function ( t1, t2 ) {
        	var u = this.knots1[this.iMin1] + t1 * (this.knots1[this.iMax1] - this.knots1[this.iMin1]); // linear mapping t1->u
        	var v = this.knots2[this.iMin2] + t2 * (this.knots2[this.iMax2] - this.knots2[this.iMin2]); // linear mapping t2->u
        	return this._getPointByParameters(u, v);
        };
        THREE.NURBSSurface.prototype._getPointByParameters = function ( u, v ) {
        	return THREE.NURBSUtils.calcSurfacePoint(this.degree1, this.degree2, this.knots1, this.knots2, this.controlPoints, u, v);
        };

        /**************************************************************
         *	NURBS Utils
         **************************************************************/

        THREE.NURBSUtils = {

        	/*
        	Finds knot vector span.

        	p : degree
        	u : parametric value
        	U : knot vector

        	returns the span
        	*/
        	findSpan: function( p,  u,  U ) {
        		var n = U.length - p - 1;

        		if (u >= U[n]) {
        			return n - 1;
        		}

        		if (u <= U[p]) {
        			return p;
        		}

        		var low = p;
        		var high = n;
        		var mid = Math.floor((low + high) / 2);

        		while (u < U[mid] || u >= U[mid + 1]) {

        			if (u < U[mid]) {
        				high = mid;
        			} else {
        				low = mid;
        			}

        			mid = Math.floor((low + high) / 2);
        		}

        		return mid;
        	},


        	/*
        	Calculate basis functions. See The NURBS Book, page 70, algorithm A2.2

        	span : span in which u lies
        	u    : parametric point
        	p    : degree
        	U    : knot vector

        	returns array[p+1] with basis functions values.
        	*/
        	calcBasisFunctions: function( span, u, p, U ) {
        		var N = [];
        		var left = [];
        		var right = [];
        		N[0] = 1.0;

        		for (var j = 1; j <= p; ++ j) {

        			left[j] = u - U[span + 1 - j];
        			right[j] = U[span + j] - u;

        			var saved = 0.0;

        			for (var r = 0; r < j; ++ r) {

        				var rv = right[r + 1];
        				var lv = left[j - r];
        				var temp = N[r] / (rv + lv);
        				N[r] = saved + rv * temp;
        				saved = lv * temp;
        			}

        			N[j] = saved;
        		}

        		return N;
        	},


        	/*
        	Calculate B-Spline curve points. See The NURBS Book, page 82, algorithm A3.1.

        	p : degree of B-Spline
        	U : knot vector
        	P : control points (x, y, z, w)
        	u : parametric point

        	returns point for given u
        	*/
        	calcBSplinePoint: function( p, U, P, u ) {
        		var span = this.findSpan(p, u, U);
        		var N = this.calcBasisFunctions(span, u, p, U);
        		var C = new THREE.Vector4(0, 0, 0, 0);

        		for (var j = 0; j <= p; ++ j) {
        			var point = P[span - p + j];
        			var Nj = N[j];
        			var wNj = point.w * Nj;
        			C.x += point.x * wNj;
        			C.y += point.y * wNj;
        			C.z += point.z * wNj;
        			C.w += point.w * Nj;
        		}

        		return C;
        	},


        	/*
        	Calculate basis functions derivatives. See The NURBS Book, page 72, algorithm A2.3.

        	span : span in which u lies
        	u    : parametric point
        	p    : degree
        	n    : number of derivatives to calculate
        	U    : knot vector

        	returns array[n+1][p+1] with basis functions derivatives
        	*/
        	calcBasisFunctionDerivatives: function( span,  u,  p,  n,  U ) {

        		var i, j, k, r;

        		var zeroArr = [];
        		for (i = 0; i <= p; ++ i)
        			zeroArr[i] = 0.0;

        		var ders = [];
        		for (i = 0; i <= n; ++ i)
        			ders[i] = zeroArr.slice(0);

        		var ndu = [];
        		for (i = 0; i <= p; ++ i)
        			ndu[i] = zeroArr.slice(0);

        		ndu[0][0] = 1.0;

        		var left = zeroArr.slice(0);
        		var right = zeroArr.slice(0);

        		for (j = 1; j <= p; ++ j) {
        			left[j] = u - U[span + 1 - j];
        			right[j] = U[span + j] - u;

        			var saved = 0.0;

        			for (r = 0; r < j; ++ r) {
        				var rv = right[r + 1];
        				var lv = left[j - r];
        				ndu[j][r] = rv + lv;

        				var temp = ndu[r][j - 1] / ndu[j][r];
        				ndu[r][j] = saved + rv * temp;
        				saved = lv * temp;
        			}

        			ndu[j][j] = saved;
        		}

        		for (j = 0; j <= p; ++ j) {
        			ders[0][j] = ndu[j][p];
        		}

        		for (r = 0; r <= p; ++ r) {
        			var s1 = 0;
        			var s2 = 1;

        			var a = [];
        			for (i = 0; i <= p; ++ i) {
        				a[i] = zeroArr.slice(0);
        			}
        			a[0][0] = 1.0;

        			for (k = 1; k <= n; ++ k) {
        				var d = 0.0;
        				var rk = r - k;
        				var pk = p - k;

        				if (r >= k) {
        					a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
        					d = a[s2][0] * ndu[rk][pk];
        				}

        				var j1 = (rk >= -1) ? 1 : -rk;
        				var j2 = (r - 1 <= pk) ? k - 1 :  p - r;

        				for (j = j1; j <= j2; ++ j) {
        					a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
        					d += a[s2][j] * ndu[rk + j][pk];
        				}

        				if (r <= pk) {
        					a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
        					d += a[s2][k] * ndu[r][pk];
        				}

        				ders[k][r] = d;

        				j = s1;
        				s1 = s2;
        				s2 = j;
        			}
        		}

        		r = p;

        		for (k = 1; k <= n; ++ k) {
        			for (j = 0; j <= p; ++ j) {
        				ders[k][j] *= r;
        			}
        			r *= p - k;
        		}

        		return ders;
        	},


        	/*
        	Calculate derivatives of a B-Spline. See The NURBS Book, page 93, algorithm A3.2.

        	p  : degree
        	U  : knot vector
        	P  : control points
        	u  : Parametric points
        	nd : number of derivatives

        	returns array[d+1] with derivatives
        	*/
        	calcBSplineDerivatives: function( p,  U,  P,  u,  nd ) {
        		var du = nd < p ? nd : p;
        		var CK = [];
        		var span = this.findSpan(p, u, U);
        		var nders = this.calcBasisFunctionDerivatives(span, u, p, du, U);
        		var Pw = [];
        		var point;
        		var k;

        		for (var i = 0; i < P.length; ++ i) {
        			point = P[i].clone();
        			var w = point.w;

        			point.x *= w;
        			point.y *= w;
        			point.z *= w;

        			Pw[i] = point;
        		}
        		for (k = 0; k <= du; ++ k) {
        			point = Pw[span - p].clone().multiplyScalar(nders[k][0]);

        			for (var j = 1; j <= p; ++ j) {
        				point.add(Pw[span - p + j].clone().multiplyScalar(nders[k][j]));
        			}

        			CK[k] = point;
        		}

        		for (k = du + 1; k <= nd + 1; ++ k) {
        			CK[k] = new THREE.Vector4(0, 0, 0);
        		}

        		return CK;
        	},


        	/*
        	Calculate "K over I"

        	returns k!/(i!(k-i)!)
        	*/
        	calcKoverI: function( k, i ) {
        		var nom = 1;
        		var j;

        		for (j = 2; j <= k; ++ j) {
        			nom *= j;
        		}

        		var denom = 1;

        		for (j = 2; j <= i; ++ j) {
        			denom *= j;
        		}

        		for (j = 2; j <= k - i; ++ j) {
        			denom *= j;
        		}

        		return nom / denom;
        	},


        	/*
        	Calculate derivatives (0-nd) of rational curve. See The NURBS Book, page 127, algorithm A4.2.

        	Pders : result of function calcBSplineDerivatives

        	returns array with derivatives for rational curve.
        	*/
        	calcRationalCurveDerivatives: function ( Pders ) {
        		var nd = Pders.length;
        		var Aders = [];
        		var wders = [];
        		var i;

        		for (i = 0; i < nd; ++ i) {
        			var point = Pders[i];
        			Aders[i] = new THREE.Vector3(point.x, point.y, point.z);
        			wders[i] = point.w;
        		}

        		var CK = [];

        		for (var k = 0; k < nd; ++ k) {
        			var v = Aders[k].clone();

        			for (i = 1; i <= k; ++ i) {
        				v.sub(CK[k - i].clone().multiplyScalar(this.calcKoverI(k, i) * wders[i]));
        			}

        			CK[k] = v.divideScalar(wders[0]);
        		}

        		return CK;
        	},


        	/*
        	Calculate NURBS curve derivatives. See The NURBS Book, page 127, algorithm A4.2.

        	p  : degree
        	U  : knot vector
        	P  : control points in homogeneous space
        	u  : parametric points
        	nd : number of derivatives

        	returns array with derivatives.
        	*/
        	calcNURBSDerivatives: function( p,  U,  P,  u,  nd ) {
        		var Pders = this.calcBSplineDerivatives(p, U, P, u, nd);
        		return this.calcRationalCurveDerivatives(Pders);
        	},


        	/*
        	Calculate rational B-Spline surface point. See The NURBS Book, page 134, algorithm A4.3.

        	p1, p2 : degrees of B-Spline surface
        	U1, U2 : knot vectors
        	P      : control points (x, y, z, w)
        	u, v   : parametric values

        	returns point for given (u, v)
        	*/
        	calcSurfacePoint: function( p, q, U, V, P, u, v ) {
        		var uspan = this.findSpan(p, u, U);
        		var vspan = this.findSpan(q, v, V);
        		var Nu = this.calcBasisFunctions(uspan, u, p, U);
        		var Nv = this.calcBasisFunctions(vspan, v, q, V);
        		var temp = [];
        		var l;

        		for (l = 0; l <= q; ++ l) {
        			temp[l] = new THREE.Vector4(0, 0, 0, 0);
        			for (var k = 0; k <= p; ++ k) {
        				var point = P[uspan - p + k][vspan - q + l].clone();
        				var w = point.w;
        				point.x *= w;
        				point.y *= w;
        				point.z *= w;
        				temp[l].add(point.multiplyScalar(Nu[k]));
        			}
        		}

        		var Sw = new THREE.Vector4(0, 0, 0, 0);
        		for (l = 0; l <= q; ++ l) {
        			Sw.add(temp[l].multiplyScalar(Nv[l]));
        		}

        		Sw.divideScalar(Sw.w);
        		return new THREE.Vector3(Sw.x, Sw.y, Sw.z);
        	}

        };

        THREE.EditorControls = function ( object, domElement, center ) {

        	domElement = ( domElement !== undefined ) ? domElement : document;

        	// API

        	this.enabled = true;
        	this.center = center = center || new THREE.Vector3();

        	// internals

        	var scope = this;
        	var vector = new THREE.Vector3();
        	var matrix = new THREE.Matrix3();

        	var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
        	var state = STATE.NONE;
        	var parentRect = null;

        	// pointer data

        	var touches = [];

        	// pointers are expressed in -1 to 1 coordinate space relative to domElement.

        	var pointers = [ new THREE.Vector2(), new THREE.Vector2() ];
        	var pointersOld = [ new THREE.Vector2(), new THREE.Vector2() ];
        	var pointersDelta = [ new THREE.Vector2(), new THREE.Vector2() ];

        	// events

        	var changeEvent = { type: 'change' };

        	// hepler functions

        	var getClosestPoint = function( point, pointArray ) {

        		if ( pointArray[ 0 ].distanceTo( point) < pointArray[ 1 ].distanceTo( point) ) {

        			return pointArray[ 0 ];

        		}

        		return pointArray[ 1 ];

        	};

        	var setPointers = function( event ) {

        		// Set pointes from mouse/touch events and convert to -1 to 1 coordinate space.
        		if (!parentRect || event.type === 'mousedown') {
        			// Cache the parent rect at the beginning of a drag event sequence
        			parentRect = event.target.getBoundingClientRect();
        		}
        		// Filter touches that originate from the same element as the event.

        		touches.length = 0;

        		if ( event.touches ) {
        			for ( var i = 0; i < event.touches.length; i++ ) {
        				if ( event.touches[ i ].target === event.target ) {
        					touches.push( event.touches[ i ] );
        				}
        			}
        		}

        		// Set pointer[0] from mouse event.clientX/Y

        		if ( touches.length === 0 ) {
        			// Compute the position on the page with a relative scale from the element
        			pointers[ 0 ].set(
        				( event.pageX - parentRect.left ) / parentRect.width * 2 - 1,
        				( event.pageY - parentRect.top ) / parentRect.height * 2 - 1
        			);

        		// Set both pointer[0] and pointer[1] from a single touch.

        		} else if ( touches.length == 1 ) {

        			pointers[ 0 ].set(
        				( touches[ 0 ].pageX - parentRect.left ) / parentRect.width * 2 - 1,
        				( touches[ 0 ].pageY - parentRect.top ) / parentRect.height * 2 - 1
        			);
        			pointers[ 1 ].copy( pointers[ 0 ] );

        		// Set pointer[0] and pointer[1] from two touches.

        		} else if ( touches.length == 2 ) {

        			pointers[ 0 ].set(
        				( touches[ 0 ].pageX - parentRect.left ) / parentRect.width * 2 - 1,
        				( touches[ 0 ].pageY - parentRect.top ) / parentRect.height * 2 - 1
        			);
        			pointers[ 1 ].set(
        				( touches[ 1 ].pageX - parentRect.left ) / parentRect.width * 2 - 1,
        				( touches[ 1 ].pageY - parentRect.top) / parentRect.height * 2 - 1
        			);

        		}

        		// Clear the cached bounds at the end of a drag event sequence
        		if (parentRect && event.type === 'mouseup') {
        			parentRect = null;
        		}
        	};

        	/**
        	 * Update camera clipping planes based on size of scene
        	 * @param  {THREE.camera} camera Perspective camera object
        	 * @param  {Number} radius Size of the scene
        	 */
        	this.updateClippingPersp = function updateClippingPersp (camera, radius) {
        		if (radius || camera || camera.near || camera.far) {
        			var nearFarRatio = Math.min(1e6, Math.max(1e3, camera.far/camera.near));
        			var factor = Math.sqrt(nearFarRatio);
        			camera.near = radius / factor;
        			camera.far = radius * factor;
        		}
        	};

        	/**
        	 * Update camera clipping planes based on size of scene
        	 * @param  {THREE.camera} camera Orthographic camera object
        	 * @param  {Number} radius Size of the scene
        	 */
        	this.updateClippingOrtho = function updateClippingOrtho (camera, radius) {
        		if (radius || camera || camera.near || camera.far) {
        			var nearFarDistance = Math.min(1e6, Math.max(1e3, 0.5*camera.far-0.5*camera.near));
        			var factor = Math.max(radius,nearFarDistance);
        			camera.near = -1 * factor;
        			camera.far = factor;
        		}
        	};


        	this.focus = function focus ( target, frame ) {

        		// Collection of all centers and radii in the hierarchy of the target.

        		var targets = [];

        		// Bounding box (minCenter/maxCenter) encompassing all centers in hierarchy.

        		var minCenter;
        		var maxCenter;

        		target.traverse( function( child ) {

        			if (child.visible) {

        				child.updateMatrixWorld( true );

        				var center = new THREE.Vector3();
        				var scale = new THREE.Vector3();
        				var radius = 0;

        				child.matrixWorld.decompose( center, new THREE.Quaternion(), scale );
        				scale = ( scale.x + scale.y + scale.z ) / 3;

        				//TODO: make work with non-uniform scale

        				if ( child.geometry ) {

        					child.geometry.computeBoundingSphere();
        					center.copy( child.geometry.boundingSphere.center.clone()
        								.applyMatrix4(child.matrixWorld) );
        					radius = child.geometry.boundingSphere.radius * scale;

        				}

        				if ( !frame || child.geometry ) {

        					targets.push( { center: center, radius: radius } );

        					if ( !minCenter ) minCenter = center.clone();
        					if ( !maxCenter ) maxCenter = center.clone();

        					minCenter.min( center );
        					maxCenter.max( center );

        				}


        			}


        		} );

        		// Bail if there is not visible geometry
        		if (!minCenter || !maxCenter) return;

        		// Center of the bounding box.

        		var cumulativeCenter = minCenter.clone().add( maxCenter ).multiplyScalar( 0.5 );

        		// Furthest ( center distance + radius ) from CumulativeCenter.

        		var cumulativeRadius = 0;

        		targets.forEach( function( child ) {

        			var radius = cumulativeCenter.distanceTo( child.center ) + child.radius;
        			cumulativeRadius = Math.max( cumulativeRadius, radius );

        		} );

        		if ( object instanceof THREE.PerspectiveCamera ) {

        			// Look towards cumulativeCenter

        			center.copy( cumulativeCenter );
        			object.lookAt( center );

        			if ( frame && cumulativeRadius ) {

        				// Adjust distance to frame cumulativeRadius

        				var fovFactor = Math.tan( ( object.fov / 2 ) * Math.PI / 180.0 );
        				var pos = object.position.clone().sub( center ).normalize().multiplyScalar( cumulativeRadius  / fovFactor );

        				object.position.copy( center ).add( pos );
        				this.updateClippingPersp(object, cumulativeRadius);
        			}

        		} else if ( object instanceof THREE.OrthographicCamera ) {

        			// Align camera center with cumulativeCenter

        			var initialCenterOffset = object.position.clone().sub( center );
        			center.copy( cumulativeCenter );
        			object.position.copy( center ).add( initialCenterOffset );

        			if ( frame && cumulativeRadius ) {

        				// Adjust camera boundaries to frame cumulativeRadius

        				var cw = object.right - object.left;
        				var ch = object.top - object.bottom;
        				var aspect = Math.abs(cw / ch);

        				if ( aspect < 1 ) {

        					object.top = Math.sign(object.top) * cumulativeRadius / aspect;
        					object.right = Math.sign(object.right) * cumulativeRadius;
        					object.bottom = Math.sign(object.bottom) * cumulativeRadius / aspect;
        					object.left = Math.sign(object.left) * cumulativeRadius;

        				} else {

        					object.top = Math.sign(object.top) * cumulativeRadius;
        					object.right = Math.sign(object.right) * cumulativeRadius * aspect;
        					object.bottom = Math.sign(object.bottom) * cumulativeRadius;
        					object.left = Math.sign(object.left) * cumulativeRadius * aspect;

        				}
        				this.updateClippingOrtho(object, cumulativeRadius);

        			}

        		}

        		scope.dispatchEvent( changeEvent );

        	};

        	this.pan = function ( delta ) {

        		var distance = object.position.distanceTo( center );

        		vector.set( -delta.x, delta.y, 0 );

        		if ( object instanceof THREE.PerspectiveCamera ) {

        			var fovFactor = distance * Math.tan( ( object.fov / 2 ) * Math.PI / 180.0 );
        			vector.multiplyScalar( fovFactor );
        			vector.x *= object.aspect;

        		} else if ( object instanceof THREE.OrthographicCamera ) {

        			vector.x *= ( object.right - object.left ) / 2;
        			vector.y *= ( object.top - object.bottom ) / 2;

        		}

        		vector.applyMatrix3( matrix.getNormalMatrix( object.matrix ) );
        		object.position.add( vector );
        		center.add( vector );

        		scope.dispatchEvent( changeEvent );

        	};

        	this.zoom = function ( delta ) {

        		if ( object instanceof THREE.PerspectiveCamera ) {

        			var distance = object.position.distanceTo( center );

        			vector.set( 0, 0, delta.y );

        			vector.multiplyScalar( distance );

        			vector.applyMatrix3( matrix.getNormalMatrix( object.matrix ) );

        			if ( delta.y < 0 && object.position.clone().add(vector).distanceTo( center ) >= distance) return;

        			object.position.add( vector );

        		} else if ( object instanceof THREE.OrthographicCamera ) {

        			object.top *= 1 + delta.y;
        			object.right *= 1 + delta.y;
        			object.bottom *= 1 + delta.y;
        			object.left *= 1 + delta.y;

        		}

        		scope.dispatchEvent( changeEvent );

        	};

        	this.rotate = function ( delta ) {

        		vector.copy( object.position ).sub( center );

        		var theta = Math.atan2( vector.x, vector.y );
        		var phi = Math.atan2( Math.sqrt( vector.x * vector.x + vector.y * vector.y ), vector.z );

        		theta += delta.x;
        		phi -= delta.y;

        		var EPS = 0.000001;

        		phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );

        		var radius = vector.length();

        		vector.x = radius * Math.sin( phi ) * Math.sin( theta );
        		vector.y = radius * Math.sin( phi ) * Math.cos( theta );
        		vector.z = radius * Math.cos( phi );

        		object.position.copy( center ).add( vector );

        		object.lookAt( center );

        		scope.dispatchEvent( changeEvent );

        	};

        	// export center so it can be restored later
        	this.toJSON = function () {
        		return {
        			cx: center.x,
        			cy: center.y,
        			cz: center.z
        		};
        	};

        	// restore the center point from previous data
        	this.fromJSON = function (data) {
        		this.center.x = data.cx;
        		this.center.y = data.cy;
        		this.center.z = data.cz;
        	};

        	// mouse

        	function onMouseDown( event ) {

        		if ( scope.enabled === false ) return;

        		if ( event.button === 0 ) {

        			state = STATE.ROTATE;

        			if ( object instanceof THREE.OrthographicCamera ) {

        				state = STATE.PAN;

        			}

        		} else if ( event.button === 1 ) {

        			state = STATE.ZOOM;

        		} else if ( event.button === 2 ) {

        			state = STATE.PAN;

        		}

        		setPointers( event );

        		pointersOld[ 0 ].copy( pointers[ 0 ] );

        		// Camera navigation continues while the user drags anywhere on the page
        		document.addEventListener( 'mousemove', onMouseMove, false );
        		document.addEventListener( 'mouseup', onMouseUp, false );
        		document.addEventListener( 'dblclick', onMouseUp, false );

        	}

        	function onMouseMove( event ) {

        		if ( scope.enabled === false ) return;

        		setPointers( event );

        		pointersDelta[ 0 ].subVectors( pointers[ 0 ], pointersOld[ 0 ] );
        		pointersOld[ 0 ].copy( pointers[ 0 ] );

        		if ( state === STATE.ROTATE ) {

        			scope.rotate( pointersDelta[ 0 ] );

        		} else if ( state === STATE.ZOOM ) {

        			scope.zoom( pointersDelta[ 0 ] );

        		} else if ( state === STATE.PAN ) {

        			scope.pan( pointersDelta[ 0 ] );

        		}

        	}

        	function onMouseUp( ) {
        		// Make sure to catch the end of the drag even outside the viewport
        		document.removeEventListener( 'mousemove', onMouseMove, false );
        		document.removeEventListener( 'mouseup', onMouseUp, false );
        		document.removeEventListener( 'dblclick', onMouseUp, false );

        		state = STATE.NONE;

        	}

        	function onMouseWheel( event ) {

        		if ( scope.enabled === false ) return;

        		event.preventDefault();

        		var delta = 0;

        		if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

        			delta = - event.wheelDelta;

        		} else if ( event.detail ) { // Firefox

        			delta = event.detail * 10;

        		}

        		scope.zoom( new THREE.Vector2( 0, delta / 1000 ) );

        	}

        	// Camera navigation begins when the user clicks inside the dom element
        	domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
        	domElement.addEventListener( 'mousedown', onMouseDown, false );
        	domElement.addEventListener( 'mousewheel', onMouseWheel, false );
        	domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

        	function touchStart( event ) {

        		if ( scope.enabled === false ) return;

        		setPointers( event );

        		pointersOld[ 0 ].copy( pointers[ 0 ] );
        		pointersOld[ 1 ].copy( pointers[ 1 ] );

        	}


        	function touchMove( event ) {

        		if ( scope.enabled === false ) return;

        		setPointers( event );

        		switch ( touches.length ) {

        			case 1:
        				pointersDelta[ 0 ].subVectors( pointers[ 0 ], getClosestPoint( pointers[ 0 ], pointersOld ) );
        				pointersDelta[ 1 ].subVectors( pointers[ 1 ], getClosestPoint( pointers[ 1 ], pointersOld ) );

        				if ( object instanceof THREE.PerspectiveCamera ) {

        					scope.rotate( pointersDelta[ 0 ] );

        				} else if ( object instanceof THREE.OrthographicCamera ) {

        					scope.pan( pointersDelta[ 0 ] );

        				}
        				break;

        			case 2:
        				pointersDelta[ 0 ].subVectors( pointers[ 0 ], getClosestPoint( pointers[ 0 ], pointersOld ) );
        				pointersDelta[ 1 ].subVectors( pointers[ 1 ], getClosestPoint( pointers[ 1 ], pointersOld ) );

        				var prevDistance = pointersOld[ 0 ].distanceTo( pointersOld[ 1 ] );
        				var distance = pointers[ 0 ].distanceTo( pointers[ 1 ] );

        				if ( prevDistance ) {

        					scope.zoom( new THREE.Vector2(0, prevDistance - distance ) );
        					scope.pan( pointersDelta[ 0 ].clone().add( pointersDelta[ 1 ] ).multiplyScalar(0.5) );

        				}
        				break;
        		}

        		pointersOld[ 0 ].copy( pointers[ 0 ] );
        		pointersOld[ 1 ].copy( pointers[ 1 ] );

        	}

        	domElement.addEventListener( 'touchstart', touchStart, false );
        	domElement.addEventListener( 'touchmove', touchMove, false );

        };

        THREE.EditorControls.prototype = Object.create( THREE.EventDispatcher.prototype );
        THREE.EditorControls.prototype.constructor = THREE.EditorControls;

        THREE.OBJLoader = function ( manager ) {

        	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

        };

        THREE.OBJLoader.prototype = {

        	constructor: THREE.OBJLoader,

        	load: function ( url, onLoad, onProgress, onError ) {

        		var scope = this;

        		var loader = new THREE.XHRLoader( scope.manager );
        		loader.setCrossOrigin( this.crossOrigin );
        		loader.load( url, function ( text ) {

        			onLoad( scope.parse( text ) );

        		}, onProgress, onError );

        	},

        	parse: function ( text ) {

        		var object, objects = [];
        		var geometry, material;

        		function parseVertexIndex( value ) {

        			var index = parseInt( value );

        			return ( index >= 0 ? index - 1 : index + vertices.length / 3 ) * 3;

        		}

        		function parseNormalIndex( value ) {

        			var index = parseInt( value );

        			return ( index >= 0 ? index - 1 : index + normals.length / 3 ) * 3;

        		}

        		function parseUVIndex( value ) {

        			var index = parseInt( value );

        			return ( index >= 0 ? index - 1 : index + uvs.length / 2 ) * 2;

        		}

        		function addVertex( a, b, c ) {

        			geometry.vertices.push(
        				vertices[ a ], vertices[ a + 1 ], vertices[ a + 2 ],
        				vertices[ b ], vertices[ b + 1 ], vertices[ b + 2 ],
        				vertices[ c ], vertices[ c + 1 ], vertices[ c + 2 ]
        			);

        		}

        		function addNormal( a, b, c ) {

        			geometry.normals.push(
        				normals[ a ], normals[ a + 1 ], normals[ a + 2 ],
        				normals[ b ], normals[ b + 1 ], normals[ b + 2 ],
        				normals[ c ], normals[ c + 1 ], normals[ c + 2 ]
        			);

        		}

        		function addUV( a, b, c ) {

        			geometry.uvs.push(
        				uvs[ a ], uvs[ a + 1 ],
        				uvs[ b ], uvs[ b + 1 ],
        				uvs[ c ], uvs[ c + 1 ]
        			);

        		}

        		function addFace( a, b, c, d,  ua, ub, uc, ud, na, nb, nc, nd ) {

        			var ia = parseVertexIndex( a );
        			var ib = parseVertexIndex( b );
        			var ic = parseVertexIndex( c );
        			var id;

        			if ( d === undefined ) {

        				addVertex( ia, ib, ic );

        			} else {

        				id = parseVertexIndex( d );

        				addVertex( ia, ib, id );
        				addVertex( ib, ic, id );

        			}

        			if ( ua !== undefined ) {

        				ia = parseUVIndex( ua );
        				ib = parseUVIndex( ub );
        				ic = parseUVIndex( uc );

        				if ( d === undefined ) {

        					addUV( ia, ib, ic );

        				} else {

        					id = parseUVIndex( ud );

        					addUV( ia, ib, id );
        					addUV( ib, ic, id );

        				}

        			}

        			if ( na !== undefined ) {

        				ia = parseNormalIndex( na );
        				ib = parseNormalIndex( nb );
        				ic = parseNormalIndex( nc );

        				if ( d === undefined ) {

        					addNormal( ia, ib, ic );

        				} else {

        					id = parseNormalIndex( nd );

        					addNormal( ia, ib, id );
        					addNormal( ib, ic, id );

        				}

        			}

        		}

        		// create mesh if no objects in text

        		if ( /^o /gm.test( text ) === false ) {

        			geometry = {
        				vertices: [],
        				normals: [],
        				uvs: []
        			};

        			material = {
        				name: ''
        			};

        			object = {
        				name: '',
        				geometry: geometry,
        				material: material
        			};

        			objects.push( object );

        		}

        		var vertices = [];
        		var normals = [];
        		var uvs = [];

        		// v float float float

        		var vertex_pattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

        		// vn float float float

        		var normal_pattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

        		// vt float float

        		var uv_pattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

        		// f vertex vertex vertex ...

        		var face_pattern1 = /f( +-?\d+)( +-?\d+)( +-?\d+)( +-?\d+)?/;

        		// f vertex/uv vertex/uv vertex/uv ...

        		var face_pattern2 = /f( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))?/;

        		// f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...

        		var face_pattern3 = /f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/;

        		// f vertex//normal vertex//normal vertex//normal ...

        		var face_pattern4 = /f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/;

        		//

        		var lines = text.split( '\n' );
        		var i;

        		for ( i = 0; i < lines.length; i ++ ) {

        			var line = lines[ i ];
        			line = line.trim();

        			var result;

        			if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

        				continue;

        			} else if ( ( result = vertex_pattern.exec( line ) ) !== null ) {

        				// ["v 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

        				vertices.push(
        					parseFloat( result[ 1 ] ),
        					parseFloat( result[ 2 ] ),
        					parseFloat( result[ 3 ] )
        				);

        			} else if ( ( result = normal_pattern.exec( line ) ) !== null ) {

        				// ["vn 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

        				normals.push(
        					parseFloat( result[ 1 ] ),
        					parseFloat( result[ 2 ] ),
        					parseFloat( result[ 3 ] )
        				);

        			} else if ( ( result = uv_pattern.exec( line ) ) !== null ) {

        				// ["vt 0.1 0.2", "0.1", "0.2"]

        				uvs.push(
        					parseFloat( result[ 1 ] ),
        					parseFloat( result[ 2 ] )
        				);

        			} else if ( ( result = face_pattern1.exec( line ) ) !== null ) {

        				// ["f 1 2 3", "1", "2", "3", undefined]

        				addFace(
        					result[ 1 ], result[ 2 ], result[ 3 ], result[ 4 ]
        				);

        			} else if ( ( result = face_pattern2.exec( line ) ) !== null ) {

        				// ["f 1/1 2/2 3/3", " 1/1", "1", "1", " 2/2", "2", "2", " 3/3", "3", "3", undefined, undefined, undefined]

        				addFace(
        					result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ],
        					result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ]
        				);

        			} else if ( ( result = face_pattern3.exec( line ) ) !== null ) {

        				// ["f 1/1/1 2/2/2 3/3/3", " 1/1/1", "1", "1", "1", " 2/2/2", "2", "2", "2", " 3/3/3", "3", "3", "3", undefined, undefined, undefined, undefined]

        				addFace(
        					result[ 2 ], result[ 6 ], result[ 10 ], result[ 14 ],
        					result[ 3 ], result[ 7 ], result[ 11 ], result[ 15 ],
        					result[ 4 ], result[ 8 ], result[ 12 ], result[ 16 ]
        				);

        			} else if ( ( result = face_pattern4.exec( line ) ) !== null ) {

        				// ["f 1//1 2//2 3//3", " 1//1", "1", "1", " 2//2", "2", "2", " 3//3", "3", "3", undefined, undefined, undefined]

        				addFace(
        					result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ],
        					undefined, undefined, undefined, undefined,
        					result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ]
        				);

        			} else if ( /^o /.test( line ) ) {

        				geometry = {
        					vertices: [],
        					normals: [],
        					uvs: []
        				};

        				material = {
        					name: ''
        				};

        				object = {
        					name: line.substring( 2 ).trim(),
        					geometry: geometry,
        					material: material
        				};

        				objects.push( object );

        			} else if ( /^g /.test( line ) ) {

        				// group

        			} else if ( /^usemtl /.test( line ) ) {

        				// material

        				material.name = line.substring( 7 ).trim();

        			} else if ( /^mtllib /.test( line ) ) {

        				// mtl file

        			} else if ( /^s /.test( line ) ) {

        				// smooth shading

        			} else {

        				// console.log( "THREE.OBJLoader: Unhandled line " + line );

        			}

        		}

        		var container = new THREE.Object3D();
        		var l;
        		for ( i = 0, l = objects.length; i < l; i ++ ) {

        			object = objects[ i ];
        			geometry = object.geometry;

        			var buffergeometry = new THREE.BufferGeometry();

        			buffergeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( geometry.vertices ), 3 ) );

        			if ( geometry.normals.length > 0 ) {
        				buffergeometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( geometry.normals ), 3 ) );
        			}

        			if ( geometry.uvs.length > 0 ) {
        				buffergeometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( geometry.uvs ), 2 ) );
        			}

        			material = new THREE.MeshLambertMaterial();
        			material.name = object.material.name;

        			var mesh = new THREE.Mesh( buffergeometry, material );
        			mesh.name = object.name;

        			container.add( mesh );

        		}

        		return container;

        	}

        };

        THREE.STLLoader = function ( manager ) {

        	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

        };

        THREE.STLLoader.prototype = {

        	constructor: THREE.STLLoader,

        	load: function ( url, onLoad, onProgress, onError ) {

        		var scope = this;

        		var loader = new THREE.XHRLoader( scope.manager );
        		loader.setCrossOrigin( this.crossOrigin );
        		loader.setResponseType( 'arraybuffer' );
        		loader.load( url, function ( text ) {

        			onLoad( scope.parse( text ) );

        		}, onProgress, onError );

        	},

        	setCrossOrigin: function ( value ) {

        		this.crossOrigin = value;

        	},

        	parse: function ( data ) {

        		var isBinary = function () {

        			var expect, face_size, n_faces, reader;
        			reader = new window.DataView( binData );
        			face_size = ( 32 / 8 * 3 ) + ( ( 32 / 8 * 3 ) * 3 ) + ( 16 / 8 );
        			n_faces = reader.getUint32( 80, true );
        			expect = 80 + ( 32 / 8 ) + ( n_faces * face_size );

        			if ( expect === reader.byteLength ) {

        				return true;

        			}

        			// some binary files will have different size from expected,
        			// checking characters higher than ASCII to confirm is binary
        			var fileLength = reader.byteLength;
        			for ( var index = 0; index < fileLength; index ++ ) {

        				if ( reader.getUint8( index, false ) > 127 ) {

        					return true;

        				}

        			}

        			return false;

        		};

        		var binData = this.ensureBinary( data );

        		return isBinary()
        			? this.parseBinary( binData )
        			: this.parseASCII( this.ensureString( data ) );

        	},

        	parseBinary: function ( data ) {

        		var reader = new window.DataView( data );
        		var faces = reader.getUint32( 80, true );

        		var r, g, b, hasColors = false, colors;
        		var defaultR, defaultG, defaultB, alpha;

        		// process STL header
        		// check for default color in header ("COLOR=rgba" sequence).

        		for ( var index = 0; index < 80 - 10; index ++ ) {

        			if ( ( reader.getUint32( index, false ) == 0x434F4C4F /*COLO*/ ) &&
        				( reader.getUint8( index + 4 ) == 0x52 /*'R'*/ ) &&
        				( reader.getUint8( index + 5 ) == 0x3D /*'='*/ ) ) {

        				hasColors = true;
        				colors = new Float32Array( faces * 3 * 3 );

        				defaultR = reader.getUint8( index + 6 ) / 255;
        				defaultG = reader.getUint8( index + 7 ) / 255;
        				defaultB = reader.getUint8( index + 8 ) / 255;
        				alpha = reader.getUint8( index + 9 ) / 255;

        			}

        		}

        		var dataOffset = 84;
        		var faceLength = 12 * 4 + 2;

        		var offset = 0;

        		var geometry = new THREE.BufferGeometry();

        		var vertices = new Float32Array( faces * 3 * 3 );
        		var normals = new Float32Array( faces * 3 * 3 );

        		for ( var face = 0; face < faces; face ++ ) {

        			var start = dataOffset + face * faceLength;
        			var normalX = reader.getFloat32( start, true );
        			var normalY = reader.getFloat32( start + 4, true );
        			var normalZ = reader.getFloat32( start + 8, true );

        			if ( hasColors ) {

        				var packedColor = reader.getUint16( start + 48, true );

        				if ( ( packedColor & 0x8000 ) === 0 ) {

        					// facet has its own unique color

        					r = ( packedColor & 0x1F ) / 31;
        					g = ( ( packedColor >> 5 ) & 0x1F ) / 31;
        					b = ( ( packedColor >> 10 ) & 0x1F ) / 31;

        				} else {

        					r = defaultR;
        					g = defaultG;
        					b = defaultB;

        				}

        			}

        			for ( var i = 1; i <= 3; i ++ ) {

        				var vertexstart = start + i * 12;

        				vertices[ offset ] = reader.getFloat32( vertexstart, true );
        				vertices[ offset + 1 ] = reader.getFloat32( vertexstart + 4, true );
        				vertices[ offset + 2 ] = reader.getFloat32( vertexstart + 8, true );

        				normals[ offset ] = normalX;
        				normals[ offset + 1 ] = normalY;
        				normals[ offset + 2 ] = normalZ;

        				if ( hasColors ) {

        					colors[ offset ] = r;
        					colors[ offset + 1 ] = g;
        					colors[ offset + 2 ] = b;

        				}

        				offset += 3;

        			}

        		}

        		geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
        		geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );

        		if ( hasColors ) {

        			geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
        			geometry.hasColors = true;
        			geometry.alpha = alpha;

        		}

        		return geometry;

        	},

        	parseASCII: function ( data ) {

        		var geometry, length, normal, patternFace, patternNormal, patternVertex, result, text;
        		geometry = new THREE.Geometry();
        		patternFace = /facet([\s\S]*?)endfacet/g;

        		while ( ( result = patternFace.exec( data ) ) !== null ) {

        			text = result[ 0 ];
        			patternNormal = /normal[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

        			while ( ( result = patternNormal.exec( text ) ) !== null ) {

        				normal = new THREE.Vector3( parseFloat( result[ 1 ] ), parseFloat( result[ 3 ] ), parseFloat( result[ 5 ] ) );

        			}

        			patternVertex = /vertex[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

        			while ( ( result = patternVertex.exec( text ) ) !== null ) {

        				geometry.vertices.push( new THREE.Vector3( parseFloat( result[ 1 ] ), parseFloat( result[ 3 ] ), parseFloat( result[ 5 ] ) ) );

        			}

        			length = geometry.vertices.length;

        			geometry.faces.push( new THREE.Face3( length - 3, length - 2, length - 1, normal ) );

        		}

        		geometry.computeBoundingBox();
        		geometry.computeBoundingSphere();

        		return geometry;

        	},

        	ensureString: function ( buf ) {

        		if ( typeof buf !== "string" ) {

        			var array_buffer = new Uint8Array( buf );
        			var str = '';
        			for ( var i = 0; i < buf.byteLength; i ++ ) {

        				str += String.fromCharCode( array_buffer[ i ] ); // implicitly assumes little-endian

        			}
        			return str;

        		} else {

        			return buf;

        		}

        	},

        	ensureBinary: function ( buf ) {

        		if ( typeof buf === "string" ) {

        			var array_buffer = new Uint8Array( buf.length );
        			for ( var i = 0; i < buf.length; i ++ ) {

        				array_buffer[ i ] = buf.charCodeAt( i ) & 0xff; // implicitly assumes little-endian

        			}
        			return array_buffer.buffer || array_buffer;

        		} else {

        			return buf;

        		}

        	}

        };

        if ( typeof window.DataView === 'undefined' ) {

        	window.DataView = function( buffer, byteOffset, byteLength ) {

        		this.buffer = buffer;
        		this.byteOffset = byteOffset || 0;
        		this.byteLength = byteLength || buffer.byteLength || buffer.length;
        		this._isString = typeof buffer === "string";

        	};

        	window.DataView.prototype = {

        		_getCharCodes: function( buffer, start, length ) {

        			start = start || 0;
        			length = length || buffer.length;
        			var end = start + length;
        			var codes = [];
        			for ( var i = start; i < end; i ++ ) {

        				codes.push( buffer.charCodeAt( i ) & 0xff );

        			}
        			return codes;

        		},

        		_getBytes: function ( length, byteOffset, littleEndian ) {

        			var result;

        			// Handle the lack of endianness
        			if ( littleEndian === undefined ) {

        				littleEndian = this._littleEndian;

        			}

        			// Handle the lack of byteOffset
        			if ( byteOffset === undefined ) {

        				byteOffset = this.byteOffset;

        			} else {

        				byteOffset = this.byteOffset + byteOffset;

        			}

        			if ( length === undefined ) {

        				length = this.byteLength - byteOffset;

        			}

        			// Error Checking
        			if ( typeof byteOffset !== 'number' ) {

        				throw new TypeError( 'DataView byteOffset is not a number' );

        			}

        			if ( length < 0 || byteOffset + length > this.byteLength ) {

        				throw new Error( 'DataView length or (byteOffset+length) value is out of bounds' );

        			}

        			if ( this.isString ) {

        				result = this._getCharCodes( this.buffer, byteOffset, byteOffset + length );

        			} else {

        				result = this.buffer.slice( byteOffset, byteOffset + length );

        			}

        			if ( ! littleEndian && length > 1 ) {

        				if ( Array.isArray( result ) === false ) {

        					result = Array.prototype.slice.call( result );

        				}

        				result.reverse();

        			}

        			return result;

        		},

        		// Compatibility functions on a String Buffer

        		getFloat64: function ( byteOffset, littleEndian ) {

        			var b = this._getBytes( 8, byteOffset, littleEndian ),

        				sign = 1 - ( 2 * ( b[ 7 ] >> 7 ) ),
        				exponent = ( ( ( ( b[ 7 ] << 1 ) & 0xff ) << 3 ) | ( b[ 6 ] >> 4 ) ) - ( ( 1 << 10 ) - 1 ),

        			// Binary operators such as | and << operate on 32 bit values, using + and Math.pow(2) instead
        				mantissa = ( ( b[ 6 ] & 0x0f ) * Math.pow( 2, 48 ) ) + ( b[ 5 ] * Math.pow( 2, 40 ) ) + ( b[ 4 ] * Math.pow( 2, 32 ) ) +
        							( b[ 3 ] * Math.pow( 2, 24 ) ) + ( b[ 2 ] * Math.pow( 2, 16 ) ) + ( b[ 1 ] * Math.pow( 2, 8 ) ) + b[ 0 ];

        			if ( exponent === 1024 ) {

        				if ( mantissa !== 0 ) {

        					return NaN;

        				} else {

        					return sign * Infinity;

        				}

        			}

        			if ( exponent === - 1023 ) {

        				// Denormalized
        				return sign * mantissa * Math.pow( 2, - 1022 - 52 );

        			}

        			return sign * ( 1 + mantissa * Math.pow( 2, - 52 ) ) * Math.pow( 2, exponent );

        		},

        		getFloat32: function ( byteOffset, littleEndian ) {

        			var b = this._getBytes( 4, byteOffset, littleEndian ),

        				sign = 1 - ( 2 * ( b[ 3 ] >> 7 ) ),
        				exponent = ( ( ( b[ 3 ] << 1 ) & 0xff ) | ( b[ 2 ] >> 7 ) ) - 127,
        				mantissa = ( ( b[ 2 ] & 0x7f ) << 16 ) | ( b[ 1 ] << 8 ) | b[ 0 ];

        			if ( exponent === 128 ) {

        				if ( mantissa !== 0 ) {

        					return NaN;

        				} else {

        					return sign * Infinity;

        				}

        			}

        			if ( exponent === - 127 ) {

        				// Denormalized
        				return sign * mantissa * Math.pow( 2, - 126 - 23 );

        			}

        			return sign * ( 1 + mantissa * Math.pow( 2, - 23 ) ) * Math.pow( 2, exponent );

        		},

        		getInt32: function ( byteOffset, littleEndian ) {

        			var b = this._getBytes( 4, byteOffset, littleEndian );
        			return ( b[ 3 ] << 24 ) | ( b[ 2 ] << 16 ) | ( b[ 1 ] << 8 ) | b[ 0 ];

        		},

        		getUint32: function ( byteOffset, littleEndian ) {

        			return this.getInt32( byteOffset, littleEndian ) >>> 0;

        		},

        		getInt16: function ( byteOffset, littleEndian ) {

        			return ( this.getUint16( byteOffset, littleEndian ) << 16 ) >> 16;

        		},

        		getUint16: function ( byteOffset, littleEndian ) {

        			var b = this._getBytes( 2, byteOffset, littleEndian );
        			return ( b[ 1 ] << 8 ) | b[ 0 ];

        		},

        		getInt8: function ( byteOffset ) {

        			return ( this.getUint8( byteOffset ) << 24 ) >> 24;

        		},

        		getUint8: function ( byteOffset ) {

        			return this._getBytes( 1, byteOffset )[ 0 ];

        		}

        	};

        }

        THREE.EffectComposer = function ( renderer, renderTarget ) {

        	this.renderer = renderer;

        	if ( renderTarget === undefined ) {

        		var pixelRatio = renderer.getPixelRatio();
        		var size = renderer.getSize();
        		var width  = Math.floor( size.width  / pixelRatio ) || 1;
        		var height = Math.floor( size.height / pixelRatio ) || 1;
        		var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };

        		renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );

        	}

        	this.renderTarget1 = renderTarget;
        	this.renderTarget2 = renderTarget.clone();

        	this.writeBuffer = this.renderTarget1;
        	this.readBuffer = this.renderTarget2;

        	this.passes = [];

        	if ( THREE.CopyShader === undefined )
                throw new Error('THREE.EffectComposer relies on THREE.CopyShader');

        	this.copyPass = new THREE.ShaderPass( THREE.CopyShader );

        };

        THREE.EffectComposer.prototype = {

        	swapBuffers: function() {

        		var tmp = this.readBuffer;
        		this.readBuffer = this.writeBuffer;
        		this.writeBuffer = tmp;

        	},

        	addPass: function ( pass ) {

        		this.passes.push( pass );

        	},

        	insertPass: function ( pass, index ) {

        		this.passes.splice( index, 0, pass );

        	},

        	render: function ( delta ) {

        		this.writeBuffer = this.renderTarget1;
        		this.readBuffer = this.renderTarget2;

        		var maskActive = false;

        		var pass, i, il = this.passes.length;

        		for ( i = 0; i < il; i ++ ) {

        			pass = this.passes[ i ];

        			if ( ! pass.enabled ) continue;

        			pass.render( this.renderer, this.writeBuffer, this.readBuffer, delta, maskActive );

        			if ( pass.needsSwap ) {

        				if ( maskActive ) {

        					var context = this.renderer.context;

        					context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

        					this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, delta );

        					context.stencilFunc( context.EQUAL, 1, 0xffffffff );

        				}

        				this.swapBuffers();

        			}

        			if ( pass instanceof THREE.MaskPass ) {

        				maskActive = true;

        			} else if ( pass instanceof THREE.ClearMaskPass ) {

        				maskActive = false;

        			}

        		}

        	},

        	reset: function ( renderTarget ) {

        		if ( renderTarget === undefined ) {

        			renderTarget = this.renderTarget1.clone();

        			var pixelRatio = this.renderer.getPixelRatio();

        			renderTarget.width  = Math.floor( this.renderer.context.canvas.width  / pixelRatio );
        			renderTarget.height = Math.floor( this.renderer.context.canvas.height / pixelRatio );

        		}

        		this.renderTarget1.dispose();
        		this.renderTarget1 = renderTarget;
        		this.renderTarget2.dispose();
        		this.renderTarget2 = renderTarget.clone();

        		this.writeBuffer = this.renderTarget1;
        		this.readBuffer = this.renderTarget2;

        	},

        	setSize: function ( width, height ) {

        		this.renderTarget1.setSize( width, height );
        		this.renderTarget2.setSize( width, height );

        	}

        };

        THREE.MaskPass = function ( scene, camera ) {

        	this.scene = scene;
        	this.camera = camera;

        	this.enabled = true;
        	this.clear = true;
        	this.needsSwap = false;

        	this.inverse = false;

        };

        THREE.MaskPass.prototype = {

        	render: function ( renderer, writeBuffer, readBuffer ) {

        		var context = renderer.context;

        		// don't update color or depth

        		context.colorMask( false, false, false, false );
        		context.depthMask( false );

        		// set up stencil

        		var writeValue, clearValue;

        		if ( this.inverse ) {

        			writeValue = 0;
        			clearValue = 1;

        		} else {

        			writeValue = 1;
        			clearValue = 0;

        		}

        		context.enable( context.STENCIL_TEST );
        		context.stencilOp( context.REPLACE, context.REPLACE, context.REPLACE );
        		context.stencilFunc( context.ALWAYS, writeValue, 0xffffffff );
        		context.clearStencil( clearValue );

        		// draw into the stencil buffer

        		renderer.render( this.scene, this.camera, readBuffer, this.clear );
        		renderer.render( this.scene, this.camera, writeBuffer, this.clear );

        		// re-enable update of color and depth

        		context.colorMask( true, true, true, true );
        		context.depthMask( true );

        		// only render where stencil is set to 1

        		context.stencilFunc( context.EQUAL, 1, 0xffffffff );  // draw if == 1
        		context.stencilOp( context.KEEP, context.KEEP, context.KEEP );

        	}

        };


        THREE.ClearMaskPass = function () {

        	this.enabled = true;

        };

        THREE.ClearMaskPass.prototype = {

        	render: function ( renderer ) {

        		var context = renderer.context;

        		context.disable( context.STENCIL_TEST );

        	}

        };

        THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

        	this.scene = scene;
        	this.camera = camera;

        	this.overrideMaterial = overrideMaterial;

        	this.clearColor = clearColor;
        	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 1;

        	this.oldClearColor = new THREE.Color();
        	this.oldClearAlpha = 1;

        	this.enabled = true;
        	this.clear = true;
        	this.needsSwap = false;
        	this.writeDepth = true;

        };

        THREE.RenderPass.prototype = {

        	render: function ( renderer, writeBuffer, readBuffer ) {

        		// enable or disable depth writing based on writeDepth
        		if (!this.writeDepth) {
        			renderer.context.depthMask( false );
        			renderer.context.disable(renderer.context.DEPTH_TEST);
        		} else {
        			renderer.context.depthMask( true );
        			renderer.context.enable(renderer.context.DEPTH_TEST);
        		}

        		this.scene.overrideMaterial = this.overrideMaterial;

        		if ( this.clearColor ) {

        			this.oldClearColor.copy( renderer.getClearColor() );
        			this.oldClearAlpha = renderer.getClearAlpha();

        			renderer.setClearColor( this.clearColor, this.clearAlpha );

        		}

        		renderer.render( this.scene, this.camera, readBuffer, this.clear );

        		if ( this.clearColor ) {

        			renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );

        		}

        		this.scene.overrideMaterial = null;
        		// reset depth mask
        		renderer.context.depthMask( true );
        		renderer.context.enable(renderer.context.DEPTH_TEST);

        	}

        };

        THREE.ShaderPass = function ( shader, textureID ) {

        	this.textureID = ( textureID !== undefined ) ? textureID : "tDiffuse";

        	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

        	this.material = new THREE.ShaderMaterial( {

        		defines: shader.defines || {},
        		uniforms: this.uniforms,
        		vertexShader: shader.vertexShader,
        		fragmentShader: shader.fragmentShader

        	} );

        	this.renderToScreen = false;

        	this.enabled = true;
        	this.needsSwap = true;
        	this.clear = false;
        	// variable to control whether this pass modifies the depth buffer
        	this.writeDepth = false;

        	this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
        	this.scene  = new THREE.Scene();

        	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
        	this.scene.add( this.quad );

        };

        THREE.ShaderPass.prototype = {

        	render: function ( renderer, writeBuffer, readBuffer ) {

        		// enable or disable depth writing based on writeDepth
        		if (!this.writeDepth) {
        			renderer.context.depthMask( false );
        			renderer.context.disable(renderer.context.DEPTH_TEST);
        		} else {
        			renderer.context.depthMask( true );
        			renderer.context.enable(renderer.context.DEPTH_TEST);
        		}

        		if ( this.uniforms[ this.textureID ] ) {

        			this.uniforms[ this.textureID ].value = readBuffer;

        		}

        		this.quad.material = this.material;

        		if ( this.renderToScreen ) {

        			renderer.render( this.scene, this.camera );

        		} else {

        			renderer.render( this.scene, this.camera, writeBuffer, this.clear );

        		}

        		// reset depth mask
        		renderer.context.depthMask( true );
        		renderer.context.enable(renderer.context.DEPTH_TEST);

        	}

        };

        THREE.StencilPass = function ( scene, camera ) {

        	this.scene = scene;
        	this.camera = camera;

        	this.enabled = true;
        	this.clear = true;
        	this.needsSwap = false;

        	this.inverse = false;

        };

        THREE.StencilPass.prototype = {

        	render: function ( renderer, writeBuffer, readBuffer ) {

        		var context = renderer.context;

        		// enable both front and back facing polygons
        		context.disable(context.CULL_FACE);

        		// enable depth test, pass for value < depth
        		context.enable(context.DEPTH_TEST);
        		context.depthFunc(context.LESS);

        		// don't update color or depth mask
        		context.colorMask( false, false, false, false );
        		context.depthMask( false );
        		context.stencilMask( 255 );

        		// enable stencil test, clear buffer
        		context.enable( context.STENCIL_TEST );
        		context.clearStencil( 0 );
        		context.stencilFunc( context.ALWAYS, 1, 0xffffffff );

        		// deccrease stencil buffer for back-facing polygons on z fail
        		context.stencilOpSeparate(context.BACK, context.KEEP, context.DECR_WRAP, context.KEEP);
        		// increase stencil buffer for front-facing polygons on z fail
        		context.stencilOpSeparate(context.FRONT, context.KEEP, context.INCR_WRAP, context.KEEP);

        		// offset polygons to avoid self shadowing artifacts
        		// TODO check if flickering at large distances can be improved with dynamic camera planes
        		context.enable(context.POLYGON_OFFSET_FILL);
        		context.polygonOffset(-0.01, 0.0);

        		// draw into the stencil buffer
        		renderer.render( this.scene, this.camera, readBuffer, this.clear );
        		renderer.render( this.scene, this.camera, writeBuffer, this.clear );

        		context.disable(context.POLYGON_OFFSET_FILL);

        		// re-enable update of color and depth
        		context.colorMask( true, true, true, true );
        		context.depthMask( true );

        		// only render where stencil is not zero
        		context.stencilFunc( context.NOTEQUAL, 0, 0xffffffff );  // draw if != 0

        		// keep stencilbuffer
        		context.stencilOp( context.KEEP, context.KEEP, context.KEEP );
        	}

        };


        THREE.ClearStencilPass = function () {

        	this.enabled = true;

        };

        THREE.ClearStencilPass.prototype = {

        	render: function ( renderer ) {

        		var context = renderer.context;

        		context.disable( context.STENCIL_TEST );
        		renderer.clear(false, false, true);

        	}

        };

        THREE.CopyShader = {

        	uniforms: {

        		"tDiffuse": { type: "t", value: null },
        		"opacity":  { type: "f", value: 1.0 }

        	},

        	vertexShader: [

        		"varying vec2 vUv;",

        		"void main() {",

        			"vUv = uv;",
        			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        		"}"

        	].join("\n"),

        	fragmentShader: [

        		"uniform float opacity;",

        		"uniform sampler2D tDiffuse;",

        		"varying vec2 vUv;",

        		"void main() {",

        			"vec4 texel = texture2D( tDiffuse, vUv );",
        			"gl_FragColor = opacity * texel;",

        		"}"

        	].join("\n")

        };

        THREE.DarkenShader = {

        	uniforms: {

        		"tDiffuse":       { type: "t",  value: null },
        		"alpha":          { type: "f",  value: 0.25 },
                "color":          { type: "v3", value: new THREE.Vector3(0.0, 0.0, 0.0) }
        	},

        	vertexShader: [

                "varying vec2 vUv;",

                "void main(void) {",

                    "vUv = uv;",

                    "vec4 p = modelViewMatrix * vec4( position, 1.0 );",
                    "gl_Position = projectionMatrix * p;",
                "}"

        	].join("\n"),

        	fragmentShader: [

                "uniform sampler2D tDiffuse;",
                "uniform float alpha;",
                "uniform vec3 color;",

        		"varying vec2 vUv;",

                "void main(void) {",
                    "vec4 shadow = vec4(alpha) * vec4(color, 1.0) + vec4(1.0 - alpha);",
                    "gl_FragColor = texture2D(tDiffuse, vUv) * shadow;",
                "}"

        	].join("\n")

        };

        THREE.FXAAShader = {

        	uniforms: {

        		"tDiffuse":   { type: "t", value: null },
        		"resolution": { type: "v2", value: new THREE.Vector2( 1 / 1024, 1 / 512 ) }

        	},

        	vertexShader: [

        		"void main() {",

        			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        		"}"

        	].join("\n"),

        	fragmentShader: [

        		"uniform sampler2D tDiffuse;",
        		"uniform vec2 resolution;",

        		"#define FXAA_REDUCE_MIN   (1.0/128.0)",
        		"#define FXAA_REDUCE_MUL   (1.0/8.0)",
        		"#define FXAA_SPAN_MAX     8.0",

        		"void main() {",

        			"vec3 rgbNW = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( -1.0, -1.0 ) ) * resolution ).xyz;",
        			"vec3 rgbNE = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( 1.0, -1.0 ) ) * resolution ).xyz;",
        			"vec3 rgbSW = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( -1.0, 1.0 ) ) * resolution ).xyz;",
        			"vec3 rgbSE = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( 1.0, 1.0 ) ) * resolution ).xyz;",
        			"vec4 rgbaM  = texture2D( tDiffuse,  gl_FragCoord.xy  * resolution );",
        			"vec3 rgbM  = rgbaM.xyz;",
        			"vec3 luma = vec3( 0.299, 0.587, 0.114 );",

        			"float lumaNW = dot( rgbNW, luma );",
        			"float lumaNE = dot( rgbNE, luma );",
        			"float lumaSW = dot( rgbSW, luma );",
        			"float lumaSE = dot( rgbSE, luma );",
        			"float lumaM  = dot( rgbM,  luma );",
        			"float lumaMin = min( lumaM, min( min( lumaNW, lumaNE ), min( lumaSW, lumaSE ) ) );",
        			"float lumaMax = max( lumaM, max( max( lumaNW, lumaNE) , max( lumaSW, lumaSE ) ) );",

        			"vec2 dir;",
        			"dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));",
        			"dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));",

        			"float dirReduce = max( ( lumaNW + lumaNE + lumaSW + lumaSE ) * ( 0.25 * FXAA_REDUCE_MUL ), FXAA_REDUCE_MIN );",

        			"float rcpDirMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + dirReduce );",
        			"dir = min( vec2( FXAA_SPAN_MAX,  FXAA_SPAN_MAX),",
        					"max( vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),",
        						"dir * rcpDirMin)) * resolution;",
        			"vec4 rgbA = (1.0/2.0) * (",
        			"texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (1.0/3.0 - 0.5)) +",
        			"texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (2.0/3.0 - 0.5)));",
        			"vec4 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * (",
        			"texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (0.0/3.0 - 0.5)) +",
        			"texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (3.0/3.0 - 0.5)));",
        			"float lumaB = dot(rgbB, vec4(luma, 0.0));",

        			"if ( ( lumaB < lumaMin ) || ( lumaB > lumaMax ) ) {",

        				"gl_FragColor = rgbA;",

        			"} else {",
        				"gl_FragColor = rgbB;",

        			"}",

        		"}"

        	].join("\n")

        };

        THREE.SAOShader = {

            uniforms: {

                // info from previous passes
                "tDiffuse":     { type: "t", value: null },
                "tDepth":       { type: "t", value: null },
                "tNorm":        { type: "t", value: null },
                "size":         { type: "v2", value: new THREE.Vector2( 512, 512 ) },

                // camera parameters
                "projInv":      { type: "m4", value: null },
                "near":         { type: "f", value: 1 },
                "far":          { type: "f", value: 600 },

                // occlsuion parameters
                "radius":       { type: "f", value: 2.0 },
                "bias":         { type: "f", value: 0.001 },
                "noise":        { type: "f", value: 0.05 },
                "intensity":    { type: "f", value: 7.5 },
                "sigma":        { type: "f", value: 0.05 },
                "projScale":    { type: "f", value: 0.03 },

                // which falloff function to use
                "variation":    { type: "i", value: 2 },

                // display only diffuse
                "onlyDiffuse":  { type: "i", value: 0 },
                // display only AO
                "onlyAO":       { type: "i", value: 0 }

            },

            // pass-through vertex shader
            vertexShader: [

                "varying vec2 vUv;",
                "varying mat3 viewInv;",

                "void main() {",
                    "vUv = uv;",
                    "viewInv = normalMatrix;",
                    "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
                "}"

            ].join("\n"),

            fragmentShader: [

                //"#extension GL_OES_standard_derivatives : enable", // TODO uncomment for THREE js r72

                "uniform sampler2D tDepth;",      // Depth texture
                "uniform sampler2D tNorm;",      // Normals texture
                "uniform sampler2D tDiffuse;",  // Diffuse rendering
                "uniform vec2 size;",

                // Camera parameters
                "uniform mat4 projInv;",          // Inverse of projection matrix
                "uniform float near;",            // Camera near plane
                "uniform float far;",            // Camera far plane

                // Occlusion parameters
                "uniform float radius;",        // World space sample radius
                "uniform float bias;",            // Bias to ignore AO in smooth corners
                "uniform float noise;",            // Amount of noise to use
                "uniform float intensity;",        // Intensity of AO
                "uniform float sigma;",            // Chosen for aesthetics
                "uniform float projScale;",        // A scale factor on the radius

                "uniform int variation;",        // Falloff function to use
                "uniform bool onlyAO;",          // Display only AO
                "uniform bool onlyDiffuse;",          // Display only diffuse

                "varying mat3 viewInv;",        // Inverse of view matrix
                "varying vec2 vUv;",

                "const int NUM_SAMPLES = 16;",
                "const int NUM_SPIRAL_TURNS = 7;",
                "const float PI = 3.14159;",

                /**
                 * Pesudo random number generator
                 *
                 * @param  {vec2} coord     uv coordinates
                 * @return {float}             random float between 0 and 1
                 */
                "float rand( const vec2 coord ) {",
                    "return fract(sin(dot(coord.xy ,vec2(12.9898,78.233))) * 43758.5453);",
                "}",

                /**
                 * Read in depth from depth texture. The value is
                 * split into the RGBA channels of the texture, so these
                 * values must be bit-shifted back to obtain the depth.
                 *
                 * @param  {vec2} coord     screen-space coordinate
                 * @return {float}             world-space z-depth
                 */
                "float readDepth( in vec2 coord ) {",
                    "vec4 rgba_depth = texture2D( tDepth, coord );",
                    "const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );",
                    "float depth = dot( rgba_depth, bit_shift );",

                    "return 2.0*near / ( far+near - depth*(far-near) );", // regular depth buffer
                "}",

                /**
                 * Calculates the view-space (camera-space) position of
                 * a given uv coordinate
                 *
                 * @param  {vec2} uv     screen-space coordinate
                 * @return {vec3}         view-space coordinate
                 */
                "vec3 calcVSPos(vec2 uv) {",
                    "float depth = readDepth( uv );",
                    "vec2 clipUV  = uv * 2.0 - vec2(1.0);", // convert to clip-space
                    "vec4 invUV = (projInv * mat4(viewInv) * vec4(clipUV, -1.0, 1.0));", // invert view and camera projections
                    "vec3 eyeRay = normalize( (invUV/invUV.w).xyz - cameraPosition);", // ray from camera

                    "vec3 wsPos = eyeRay * depth + cameraPosition;", // world-space position
                    "return (viewMatrix * vec4(wsPos, 1.0)).xyz;", // re-project world-space position to screen space
                "}",

                /**
                 * Gets the screen-space location of a sample on a unit disk
                 *
                 * @param  {int} sampleNumber     the index of the current sample
                 * @param  {float} spinAngle     the angle on the unit disk
                 * @return {float} ssR             the screen space radius of the sample location
                 * @return {vec2}                 the unit vector offset
                 */
                "vec2 tapLocation(int sampleNumber, float spinAngle, out float ssR) {",
                    "float alpha = (float(sampleNumber) + 0.5) / float(NUM_SAMPLES);",
                    "float angle = alpha * (float(NUM_SPIRAL_TURNS) * 6.28) + spinAngle;",

                    "ssR = alpha;",

                    "return vec2(cos(angle), sin(angle));",
                "}",

                /**
                 * Gets the view-space position of the point at screen-space pixel uv:
                 * uv + unitOffset * ssR
                 *
                 * @param  {vec2} uv            screen-space coordinate
                 * @param  {vec2} unitOffset    unit vector in offset direciton
                 * @param  {float} ssR          screen-space radius
                 * @return {vec3}               view-space position of point at uv
                 */
                "vec3 getOffsetPt(vec2 uv, vec2 unitOffset, float ssR) {",
                    "vec2 offsetUV = uv + ssR * unitOffset * (size.y / size.x);",
                    "return calcVSPos(offsetUV);",
                "}",

                /**
                 * Calculates the ambient occlusion from pixel uv from the
                 * sample with index tapIndex
                 *
                 * @param  {vec2} uv                screen-space coordinate
                 * @param  {vec3} vsPos             view-space position
                 * @param  {vec3} vsNorm            view-space normal
                 * @param  {float} sampleSSR         screen-space sampling radius
                 * @param  {int} tapIndex              index of current sample
                 * @param  {float} rotationAngle     angle of rotation on unit disk
                 * @return {float}                   occlusion from this sample
                 */
                "float sampleAO(vec2 uv, vec3 vsPos, vec3 vsNorm, float sampleSSR, int tapIndex, float rotationAngle) {",
                    "const float epsilon = 0.01;",
                    "float r2 = radius * radius;",

                    // offset on the unit disk, spun for this pixel
                    "float ssR;",
                    "vec2 unitOffset = tapLocation(tapIndex, rotationAngle, ssR);",
                    "ssR *= sampleSSR;",

                    // view-space coordinate of sample point
                    "vec3 Q = getOffsetPt(uv, unitOffset, ssR);",
                    "vec3 v = Q - vsPos;",

                    "float vv = dot(v, v) / projScale;",
                    "float vn = dot(v, vsNorm);",

                    "if (variation == 1) {",
                         // Smoother transition to zero (lowers contrast, smoothing out corners)
                         "float f = max(r2 - vv, 0.0);",
                         "return f * f * f * max( (vn - bias) / (epsilon + vv), 0.0);",
                     "} else if (variation == 2) {",
                         // Medium contrast (which looks better at high radii), no division.
                         "float invR2 = 1.0 / r2;",
                         "return 4.0 * max(1.0 - vv * invR2, 0.0) * max(vn, 0.0);",
                     "} else if (variation == 3) { ",
                         // Low contrast, no division operation
                         "return 2.0 * float(vv < r2) * max(vn, 0.0);",
                     "} else {",
                         // Default to variation == 0
                         // From HPG12 paper (large epsilon to avoid overdarkening within cracks)
                         "return float(vv < r2) * max(vn / (epsilon + vv), 0.0);",
                    "}",

                "}",

                /**
                 * Calculates the total occlusion of pixel uv by sampling
                 * nearby pixels and summing the occlusion from each
                 *
                 * @param  {vec2} uv       texture coordinate of current pixel
                 * @return {float}        occlusion of pixel uv in [0, 1]
                 */
                "float calcAO(vec2 uv) {",
                    "vec3 vsPos = calcVSPos(uv);",
                    "vec3 vsNorm = texture2D( tNorm, uv).rgb;",

                    "float sampleNoise = rand(uv) * noise;",
                    "float rAngle = 2.0 * PI * sampleNoise;", // random angle

                    "float ssR = projScale * radius / ( vsPos.z ) ;", // radius of influence in screen space

                    // sum occlusion from each sample and average
                    "float occlusion = 0.0;",
                    "for (int i = 0; i < NUM_SAMPLES; ++i) {",
                        "occlusion += sampleAO(uv, vsPos, vsNorm, ssR, i, rAngle);",
                    "}",
                    "occlusion = (1.0 - occlusion * (2.0*sigma / float(NUM_SAMPLES)));",
                    "occlusion = clamp(pow(occlusion, 1.0 + intensity), 0.0, 1.0);",

                    // TODO uncomment for THREE js r72
                    // slight blur (from paper), effects are subtle
                    /*"if (abs(dFdx(vsPos.z)) < 0.02) {",
                        "occlusion -= dFdx(occlusion) * ((uv.x) - 0.5);",
                    "}",
                    "if (abs(dFdy(vsPos.z)) < 0.02) {",
                        "occlusion -= dFdy(occlusion) * ((uv.y) - 0.5);",
                    "}",*/

                    "return occlusion;",
                "}",

                "void main(void) {",
                    // diffuse color of pixel
                    "vec4 color = texture2D( tDiffuse, vUv );",

                    "if (onlyDiffuse) {",
                        "gl_FragColor = vec4( color.rgb, 1.0 );",
                    "} else {",
                        "float occlusion = calcAO( vUv );",
                        "if (onlyAO) {",
                            "gl_FragColor = vec4( vec3(occlusion), 1.0 );",
                        "} else {",
                            "gl_FragColor = vec4( vec3(occlusion)*color.rgb, 1.0 );",
                        "}",
                    "}",

                "}"



            ].join("\n")

        };

        var r={ca:"2.0"};r.c={random:Math.random,da:function(b){for(var c=b.length-1;0<c;c--){var l=Math.floor(r.c.random()*(c+1)),k=b[c];b[c]=b[l];b[l]=k}return b},G:function(b,c){var l=b.y-c.y;if(l<r.c.D)return-1;if(l>r.c.n)return 1;l=b.x-c.x;return l<r.c.D?-1:l>r.c.n?1:0},N:function(b,c,l){return(c.x-b.x)*(l.y-b.y)-(c.y-b.y)*(l.x-b.x)}};r.c.n=Math.pow(2,-43);r.c.D=-r.c.n;function u(b){this.U=[];this.r=[];this.X=[];this.L=0;this.F=[];this.R=[];this.T=[];if(b)for(var c=0,l=b.length;c<l;c++){var k=w(this,b[c]);if(3>k.length)console.log("Polygon has < 3 vertices!",k);else{for(var a=void 0,e=void 0,d=void 0,f=0;f<k.length-1;f++)a=x(this,k[f],k[f+1]),d?(a.o=d,d.m=a):e=a,d=a,this.r.push(a);a=x(this,k[k.length-1],k[0]);a.o=d;d.m=a;this.r.push(a);e.o=a;a.m=e;this.F[this.L++]=!0}}}u.prototype={Q:function(){return this.F.concat()}};
        function B(b,c,l,k){b.T.push([c.id,l.id,k.id])}
        function w(b,c){function l(a,b){return Math.abs(a.x-b.x)<r.c.n&&Math.abs(a.y-b.y)<r.c.n}function k(a,b,c){if(Math.abs(r.c.N(b,a,c))>r.c.n)return!1;var d;Math.abs(a.y-b.y)<r.c.n?(d=b.x,a.x<c.x?(b=a.x,a=c.x):(b=c.x,a=a.x)):(d=b.y,a.y<c.y?(b=a.y,a=c.y):(b=c.y,a=a.y));return b-d<r.c.n&&d-a<r.c.n}for(var a=[],e,d,f,h=0;h<c.length;h++)e=D(b,c[h].x,c[h].y),d=!0,f=a.length-1,0<=f&&(l(e,a[f])?d=!1:0<f&&k(a[f-1],a[f],e)&&a.pop()),d&&a.push(e);f=a.length-1;0<f&&l(a[f],a[0])&&(a.pop(),f--);1<f&&(k(a[f-1],a[f],
        a[0])&&(a.pop(),f--),1<f&&k(a[f],a[0],a[1])&&a.shift());return a}function x(b,c,l){return{O:b.L,a:c,i:l,p:1==r.c.G(l,c),o:null,m:null,H:null,I:null,v:!1,J:null,K:null,j:null,g:null,w:!1}}function D(b,c,l){c={id:b.U.length,x:c,y:l};b.U.push(c);return c};function E(b){this.k=b}E.prototype={};function F(b,c,l,k){this.q=b?b:{x:Number.POSITIVE_INFINITY,y:Number.POSITIVE_INFINITY};this.l=c?c:{x:Number.NEGATIVE_INFINITY,y:Number.NEGATIVE_INFINITY};this.t=l;this.s=k;this.depth=-1}F.prototype={};function G(b){var c=new F(b.q,b.l,b.t,b.s);c.e=b.e;c.f=b.f;c.b=b.b;c.d=b.d;c.u=b.u;return c}function H(b){this.A=b;b.u=this}H.prototype={};function I(b){var c=new F(null,null,null,null);this.B=[];J(this,c);this.root=new H(c);if(b)for(b=b.r,c=0;c<b.length;c++)b[c].H=b[c].I=this.root,b[c].v=!1}
        I.prototype={P:function(b){var c,l,k=b.U.length,a=Array(k);for(c=0;c<k;c++)a[c]=Array(8);var e=Array(k);c=0;for(l=this.B.length;c<l;c++){var d=this.B[c],f=d.e?d.f?5:7:d.f?4:6,h=d.b?d.d?1:0:d.d?3:2;if(1==d.depth%2){if(5==f||1==h||7==f&&3==h||4==f&&0==h){var g;g={a:d.l,i:d.q,j:null,g:null,w:!1};b.X.push(g);var p;p={a:d.q,i:d.l,aa:g,j:null,g:null,w:!1};b.X.push(p);g.aa=p;a[d.l.id][h]=g;a[d.q.id][f]=p}}else null!=d.q.id&&(e[d.q.id]=f),null!=d.l.id&&(e[d.l.id]=h)}var t;for(c=0;c<k;c++)if(d=a[c],f=e[c],
        null!=f){l=f;h=null;do if(7<l++&&(l=0),b=d[l])h?(b.j=h,h.g=b):(t=b.a,t.Y=b),h=b.aa;while(l!=f);h&&(t.Z=h)}}};
        function L(b,c){function l(){var a=m.e||m.f;a.b&&a.d?m==a.b?(n.e=null,a.b=q):(q.f=null,a.d=n):(n.e=null,n.f=a,a.d=n)}function k(a){m.l==t.l?(f?m.b?(a.e=q,q.b=a,n.d=null):(a.f=n,q.b=null,n.d=a):(a.e=q,a.f=n,q.b=n.d=a),q.d=n.b=null):(a.e&&a.f&&(a.e==m?(a.C=a.f,a.ba=!0):(a.C=a.e,a.ba=!1)),a.e=q,a.f=n,q.d=n.b=a,q.b=n.d=null)}function a(){var a;if(m.l==t.l&&f)m.b.e=q,m.d.f=n,q.b=m.b,n.d=m.d,a=q.d=n.b=null;else{m.b.e=q;m.d.f=n;var b=M(c,m.l);if(0<b)a=!0;else if(0>b)a=!1;else{a=m.b.s;var d=a.p,b=d?a.a:a.i,
        b=M(c,b);0<b?a=!0:0>b?a=!1:(a=d?a.m:a.o,b=d?a.i:a.a,b=M(c,b),a=0<b?!0:!1)}a?(a=m.d,m.d.e=q,q.b=m.b,n.d=null):(a=m.b,m.b.f=n,n.d=m.d,q.b=null);q.d=n.b=a}return a}N(c);var e,d,f,h,g,p;c.p?(e=c.a,h=c.i,d=c.H,g=c.I,f=c.o.v,p=c.m.v):(e=c.i,h=c.a,d=c.I,g=c.H,f=c.m.v,p=c.o.v);p||(p=O(b,g,h,!1),g==d&&(d=p),g=p);g=g.A;if(g.e||g.f)if(g.q!=h)console.log("ERR add_segment: trFirstHigh != segHigh: ",g);else{f||(d=O(b,d,e,!0));var t=d.A,m=g,q,n,y,v;for(e=b.B.length+2;m;){if(0>--e){console.log("ERR add_segment: infinite loop",
        m,c,b);return}if(!m.b&&!m.d){console.log("ERR add_segment: missing successors",m,c,b);return}d=m.u;d.h=c;d.A=null;v&&v.s==m.s?(q=m,n=v,n.l=m.l,d.left=new H(q),d.right=v.u):(y&&y.t==m.t?(n=m,q=y,q.l=m.l,d.left=y.u):(q=m,n=P(b,m),d.left=new H(q)),d.right=new H(n));m.e&&m.f?m.C?(m.ba?(n.e=m.f,n.f=m.C,n.e.b=n,n.f.d=n):(q.f=m.e,q.e=m.C,q.e.b=q,q.f.d=q),q.C=n.C=null):m.q==g.q?(n.f.d=n,q.f=n.e=null):n==m?(n.e=n.f,n.f=null,n.e.b=n):(q.f=q.e,q.e=null):l();m.b&&m.d?d=a():(d=m.b?m.b:m.d,k(d));q.s&&(q.s.J=n);
        n.t&&(n.t.K=q);q.s=n.t=c;c.J=q;c.K=n;m.l!=t.l?(y=q,v=n,m=d):m=null}c.v=!0}else console.log("ERR add_segment: missing trFirst.uX: ",g)}
        function Q(b,c){if(c)var l=b.a,k=b.i,a=b.H;else l=b.i,k=b.a,a=b.I;for(var e;a;)if(a.V)a=-1==r.c.G(l==a.V?k:l,a.V)?a.left:a.right;else if(a.h){if(l==a.h.a||l==a.h.i)if(Math.abs(l.y-k.y)<r.c.n){a=Math.abs(a.h.a.y-a.h.i.y)<r.c.n?l==a.h.a?((e=b.p?k.x>=a.h.i.x:k.x<a.h.i.x)?b.o.p:a.h.m.p)?a.right:a.left:((e=b.p?k.x<a.h.a.x:k.x>=a.h.a.x)?b.m.p:a.h.o.p)?a.left:a.right:k.x<l.x?a.left:a.right;continue}else e=M(a.h,k),0==e&&(e=l==a.h.a?(e=b.p?k.y>=a.h.i.y:k.y<a.h.i.y)?M(a.h,b.o.a):-M(a.h,a.h.m.i):(e=b.p?k.y<
        a.h.a.y:k.y>=a.h.a.y)?M(a.h,b.m.i):-M(a.h,a.h.o.a));else e=M(a.h,l),0==e&&(e=M(a.h,k),0==e&&(e=M(a.h,c?b.o.a:b.m.i)));if(0<e)a=a.left;else if(0>e)a=a.right;else break}else{a.A||console.log("ptNode: unknown type",a);c?b.H=a:b.I=a;break}}function N(b){Q(b,!0);Q(b,!1)}function M(b,c){var l;l=b.a.x-c.x;var k=b.i.x-c.x,a=Math.abs(b.a.y-c.y)<r.c.n;if(Math.abs(b.i.y-c.y)<r.c.n){if(a)return 0;l=k}else if(!a)return b.p?r.c.N(b.a,b.i,c):r.c.N(b.i,b.a,c);return Math.abs(l)<r.c.n?0:l}
        function O(b,c,l,k){var a=c.A;if(a.q==l||a.l==l)return c;var e=G(a);a.l=e.q=l;a.b=e;e.e=a;a.d=e.f=null;e.b&&(e.b.e=e);e.d&&(e.d.f=e);J(b,e);c.V=l;c.A=null;c.right=new H(a);c.left=new H(e);return k?a.u:e.u}function P(b,c){var l=G(c);J(b,l);return l}function J(b,c){c.fa=b.B.length;b.B.push(c)}function V(b){this.k=b;this.$=new I(this.k)}V.prototype={P:function(){return this.$.P(this.k)}};function W(b){this.k=b;this.S=null}W.prototype={};function X(b){this.k=b}X.prototype={};function Z(){this.M=null}
        Z.prototype={W:function(){this.M=null},Q:function(){return this.M?this.M.Q():null},ea:function(b,c){this.W();if(!b||0==b.length)return[];var l=new u(b),k=c?!1:1==l.L;if(k){k=new E(l);a:{var a=k.k,e=a.r[0],d=e,f=e,h=0;do h+=(f.a.x-f.i.x)*(f.a.y+f.i.y),f=f.m;while(f!=e);if(0>h){do d.j=d.m,d=d.g=d.o;while(d!=e);a.F[0]=!1}else{do d.j=d.o,d=d.g=d.m;while(d!=e)}for(e=a=e;a.g!=a.j;){b:{var d=a.j.a.x,f=a.j.a.y,h=a.a.x,g=a.a.y,p=a.g.a.x,t=a.g.a.y,m=p-h,q=t-g,n=d-p,y=f-t,v=h-d,K=g-f;if(r.c.n>v*q-m*K)d=!1;else{for(var Y=
        a.j.j,C=a.g;C!=Y;){var C=C.g,z=C.a.x,A=C.a.y,R=z-d,S=A-f;if(0!=R||0!=S){var T=z-h,U=A-g;if(0!=T||0!=U)if(z-=p,A-=t,(0!=z||0!=A)&&m*U-q*T>=r.c.D&&v*S-K*R>=r.c.D&&n*A-y*z>=r.c.D){d=!1;break b}}}d=!0}}if(d)B(k.k,a.j.a,a.a,a.g.a),a.j.g=a.g,a.g.j=a.j,e=a=a.g;else if(a=a.g,a==e){k=!1;break a}}k=!0}}if(!k){k=new W(l);k.S=new V(k.k);e=k.S;a=e.k.r.concat();r.c.da(a);d=0;f=e.k.L;if(1!=f)for(h=Array(f),g=a.concat(),p=0;p<g.length;p++)t=g[p].O,h[t]?a[f++]=g[p]:(a[d++]=g[p],h[t]=!0);d=a.length;f=e.$;h=0;for(g=
        d;h<d;){g=Math.log(g)/Math.LN2;for(p=1<g?Math.floor(d/g):d;h<p;h++)L(f,a[h]);for(p=h;p<d;p++)N(a[p])}var e=e.k,f=[f.B[0]],h=[],s,p=0;do{for(t=1==p%2;g=f.pop();)-1==g.depth&&(g.depth=p,g.e&&f.push(g.e),g.f&&f.push(g.f),g.b&&f.push(g.b),g.d&&f.push(g.d),(s=g.t)&&-1==s.J.depth&&h.push(s.J),s=g.s)&&(-1==s.K.depth&&h.push(s.K),s.p!=t&&(e.F[s.O]=!1));f=h;h=[];p++}while(0<f.length);for(p=0;p<d;p++)a[p].J=a[p].K=null;k.S.P();s=k.k;d=0;for(f=s.r.length;d<f;d++){a=s.r[d];s.F[a.O]?(e=a.i,a.j=a.o,a.g=a.m):(e=
        a.a,a=a.m,a.j=a.m,a.g=a.o);if(h=a.a.Z)h.g=a,a.j=h,a.a.Z=null;if(h=e.Y)h.j=a,a.g=h,e.Y=null}s=k.k;s.R=[];k=0;for(a=s.r.length;k<a;k++)if(e=s.r[k],!e.w){a:{h=f=d=void 0;g=e;f=h=e.a;e.w=!0;for(e=e.g;d=e.a;){if(e.w){if(d==f)break;console.log("ERR unique_monotone: segment in two chains",f,e);e=null;break a}e.w=!0;1==r.c.G(d,h)&&(h=d,g=e);e=e.g}e=g}e&&s.R.push(e)}s=k=new X(l);k=s.k.R;s.k.T=[];for(a=0;a<k.length;a++)if(f=k[a],e=f.j,d=f.g,d.g==e)B(s.k,f.a,d.a,e.a);else if(e=s,d=f.g,f=f.a,h=[d.a],g=0,d=d.g,
        p=d.a,p!=f){for(;p!=f||1<g;)if(0<g)if(t=r.c.N(h[g],p,h[g-1]),Math.abs(t)<=r.c.n&&(p==f||r.c.G(h[g],p)==r.c.G(h[g],h[g-1]))&&(t=1),0<t)B(e.k,h[g-1],h[g],p),g--;else if(h[++g]=p,p==f)for(console.log("ERR uni-y-monotone: only concave angles left",h);1<g;)g--,B(e.k,h[g-1],h[g],h[g+1]);else d=d.g,p=d.a;else h[++g]=p,d=d.g,p=d.a;B(e.k,h[g-1],h[g],p)}}this.M=l;return l.T.concat()}};window.PNLTRI=r;r.REVISION=r.ca;r.Math=r.c;r.Triangulator=Z;Z.prototype.clear_lastData=Z.prototype.W;Z.prototype.get_PolyLeftArr=Z.prototype.Q;Z.prototype.triangulate_polygon=Z.prototype.ea;

        //replace built-in triangulation with PnlTri.js
        THREE.Shape.Utils.triangulateShape = (function() {
          var pnlTriangulator = new PNLTRI.Triangulator();
          return function(contour, holes) {
              // console.log("new Triangulation: PnlTri.js " + PNLTRI.REVISION );
              return pnlTriangulator.triangulate_polygon([contour].concat(holes));
          };
        })();

        THREE.ShadowBuilder = function ( position, category ) {
            /**
             * The origin of the light that is casting shadows.
             * Directional lights are always pointing at the origin
             *
             * @type {THREE.Vector3}
             */
            this.origin = position;

            /**
             * The type of the light source, 'directional' or 'point'
             *
             * @type {String}
             * @default 'directional'
             */
            this.category = 'directional';
            if (category) this.category = category;

            /**
             * Dictionary mapping the unique id of a THREE.Mesh (uuid)
             * to its shadow volume
             *
             * @type {Object}
             */
            this.meshes = {};

            /**
             * Default material for all shadow volumes. The only
             * requirement is that it is double-sided.
             *
             * @type {THREE.Material}
             */
            this.material = new THREE.MeshLambertMaterial( { side: THREE.DoubleSide } );

            /**
             * Extent of the shadow volume, based on the camera
             * far plane. If the back of the volume is cut off, there
             * will be shadow artifacts.
             *
             * TODO: get from camera. (Should be slightly less than far plane)
             *
             * @type {Number}
             */
            this.far = 10000.0 * 0.75;

            /**
             * Offsets the shadow volume to prevent z-fighting where
             * volume faces are coincident with geometry. High bias
             * causes bleeding, low bias causes z-fighting.
             *
             * @type {Number}
             */
            this.bias = 0.0075;
        };

        THREE.ShadowBuilder.prototype = {

            // INITIALIZATION

            /**
             * Adds a mesh (THREE.Mesh) to the shadow builder.
             * Creates a dictionary entry for this mesh, holding geometry
             * information and shadow volume information.
             *
             * @param {THREE.Mesh} mesh      the mesh casting the shadow
             */
            _addMesh: function ( mesh ) {
                this.meshes[mesh.uuid] = {
                    'v' : null,
                    'f' : null,

                    'matrixWorld' : new THREE.Matrix4(),
                    'normalMatrix' : new THREE.Matrix3(),

                    'vertices': [],     // holds vertices (THREE.Vector3) of shadow volume
                    'faces': [],        // holds faces (THREE.Face3) of shadow volume
                    'volume': null      // shadow volume
                };

                mesh.updateMatrixWorld(true);
                // mesh transform matrix
                this.meshes[mesh.uuid].matrixWorld = mesh.matrixWorld;
                // inverse transpose of upper 3x3 for normal transforms
                this.meshes[mesh.uuid].normalMatrix.getNormalMatrix(mesh.matrixWorld);

                this._addGeometry(mesh);

                var volume = new THREE.Mesh(new THREE.Geometry(), this.material);
                volume.geometry.vertices = this.meshes[mesh.uuid].vertices;
                volume.geometry.faces = this.meshes[mesh.uuid].faces;
                this.meshes[mesh.uuid].volume = volume;
            },

            /**
             * Transforms and adds vertex and face info from a mesh.
             *
             * @param {THREE.Mesh} mesh      the mesh casting the shadow
             */
            _addGeometry: function ( mesh ) {
                // the BufferGeometry holds vertices and faces in a different format
                var geom;
                if (mesh.geometry instanceof THREE.BufferGeometry) {
                    geom = new THREE.Geometry().fromBufferGeometry( mesh.geometry );
                } else {
                    geom = mesh.geometry.clone(); // TODO any way to avoid cloning entire geom?
                }
                geom.computeFaceNormals();
                geom.mergeVertices();

                // input geometry values
                var v = geom.vertices;
                var f = geom.faces;

                // transform vertices by mesh scale/rotate/translate
                for (var i = 0; i < v.length; i++) {
                    v[i].applyMatrix4(this.meshes[mesh.uuid].matrixWorld);
                }

                this.meshes[mesh.uuid].v = v;
                this.meshes[mesh.uuid].f = f;

                geom.dispose();
            },

            // GEOMETRY COMPUTATION

            /**
             * Deletes the current volume geometry if it exists,
             * then computes the silhouette, calculates the shadow
             * volume and the THREE.js mesh representing it.
             *
             * @param  {String} meshID       unique id of mesh
             */
            _computeShadowVolume: function ( meshID ) {
                // clear previous volume calculation
                this.meshes[meshID].vertices.length = 0;
                this.meshes[meshID].faces.length = 0;
                if (this.meshes[meshID].volume) {
                    this.meshes[meshID].volume.geometry.dispose();
                }

                var edges = this._getSilhouetteAndCap(meshID);
                this._computeShadowSides(meshID, edges);

                var volume = this.meshes[meshID].volume;
                volume.geometry = new THREE.Geometry();
                volume.geometry.vertices = this.meshes[meshID].vertices;
                volume.geometry.faces = this.meshes[meshID].faces;

                this.meshes[meshID].volume.geometry.computeFaceNormals();
            },

            /**
             * Extrudes the silhouette in the direction of the light,
             * adds these triangles to the list of vertices and faces.
             *
             * @param  {String} meshID       unique id of mesh
             * @param  {String[]} edges      array of edges in silhouette
             */
            _computeShadowSides: function ( meshID, edges ) {
                // generates two triangles for each side
                for (var i = 0; i < edges.length; i++) {
                    var a = this._projectVertex(this.meshes[meshID].v[edges[i][0]], this.bias);
                    var b = this._projectVertex(this.meshes[meshID].v[edges[i][1]], this.bias);
                    var a_prime = this._projectVertex(a, this.far);
                    var b_prime = this._projectVertex(b, this.far);
                    this._addQuad(meshID, a, a_prime, b, b_prime);
                }
            },

            /**
             * Calculates the silhouette of the geometry. Each edge is added
             * to the dictionary if not yet present, and the appropriate boolean
             * (light-facing or not-light-facing) is set to be true. An edge
             * from vertex a to vertex b is represented as the string 'a_b'
             * ('a_b' == 'b_a') plus the array [a, b].
             *
             * While iterating through the faces, this function
             * also computes the back and front caps of the shadow volume.
             *
             * @param  {String} meshID       unique id of mesh
             * @return {Array.<Array.<Number>>}     array of edges in silhouette
             */
            _getSilhouetteAndCap: function ( meshID ) {
                var edgeDict = {}; // edges currently in silhouette
                var edges = []; // final silhouette edges
                var i, j, face, verts, isFacing, a, b;

                // iterate over all triangles
                var f = this.meshes[meshID].f;
                var v = this.meshes[meshID].v;
                for (i = 0; i < f.length; i++) {
                    face = f[i];
                    verts = [face.a, face.b, face.c];

                    // check if triangle is light-facing
                    isFacing = this._isLightFacing( meshID, face );
                    for (j = 0; j < 3; j++) {
                        a = verts[j];
                        b = verts[(j+1)%3];
                        this._addEdge( edgeDict, a, b, isFacing );
                    }

                    // add non-light-facing triangles as caps
                    if (!isFacing) {
                        this._addCapTriangle(meshID, v[face.a], v[face.c], v[face.b]);
                    }
                }

                var manifold = true;
                for (var k in edgeDict) {
                    // first check if edge is manifold
                    if (!edgeDict[k].manifold) {
                        manifold = false;
                        break;
                    } else if (edgeDict[k].front && edgeDict[k].back) {
                        // all edges on the border between light-facing and
                        // back-facing are part of the silhouette
                        var endpts = edgeDict[k].verts;
                        edges.push(endpts);
                    }
                }

                // for non-manifold geometries, add all edges to the silhouette
                if (!manifold) {
                    edges.length = 0;
                    for (i = 0; i < f.length; i++) {
                        face = f[i];
                        verts = [face.a, face.b, face.c];

                        isFacing = this._isLightFacing( meshID, face );
                        for (j = 0; j < 3; j++) {
                            a = verts[j];
                            b = verts[(j+1)%3];
                            var edge = !isFacing ? [b, a] : [a, b];
                            edges.push(edge);
                        }

                        // add remaining triangles to caps
                        if (isFacing) {
                            this._addCapTriangle(meshID, v[face.a], v[face.b], v[face.c]);
                        }
                    }
                }

                return edges;
            },

            // MATH FUNCTIONS

            /**
             * Check if triangle faces the light. For point lights, calculate
             * a ray from the light origin to the center of the triangle. For
             * directional lights use a ray in the light direction.
             *
             * @param  {string} meshID       unique id of mesh
             * @param  {THREE.Face3} face    the current face
             * @return {bool}                true if triangle faces the light
             */
            _isLightFacing: function ( meshID, face ) {
                var n = face.normal.clone().applyMatrix3(this.meshes[meshID].normalMatrix);

                if (this.category == 'point') {
                    var v = this.meshes[meshID].v;
                    var a = v[face.a];
                    var b = v[face.b];
                    var c = v[face.c];
                    var center = new THREE.Vector3();
                    center.x = (a.x + b.x + c.x)/3.0;
                    center.y = (a.y + b.y + c.y)/3.0;
                    center.z = (a.z + b.z + c.z)/3.0;
                    var dir = this.origin.clone().sub(center);
                    return ( n.dot(dir) >= 0 );
                } else {
                    return ( n.dot(this.origin) >= 0 );
                }

            },

            /**
             * Projects a vertex in the direction of the light for a length
             * of dist. For point lights, project from light origin,
             * for directional lights, project along light direction.
             *
             * @param  {THREE.Vector3} v     vertex to be projected
             * @param  {Number} dist         distance to project
             * @return {THREE.Vector3}       new, projected vertex
             */
            _projectVertex: function ( v, dist ) {
                var v_prime = v.clone();

                if (this.category == 'point') {
                    var dir = v.clone().sub(this.light).normalize();
                    v_prime.add(dir.multiplyScalar(dist));
                } else {
                    var l = this.origin.clone().normalize();
                    l.negate().multiplyScalar(dist);
                    v_prime.add(l);
                }

                return v_prime;
            },

            // GEOMETRY ADDITION

            /**
             * Attempts to add the edge from vertex a to b. Edges are
             * defined as a string 'a_b'. Removes edge from dict if
             * either 'a_b' or 'b_a' is already present.
             *
             * @param {Object} edgeDict      dictionary of processed edges
             * @param {int} a                index of vertex a
             * @param {int} b                index of vertex b
             * @param {bool} isFacing        is the edge from a light-facing triangle
             */
            _addEdge: function ( edgeDict, a, b, isFacing ) {
                var name = a+'_'+b;
                if (edgeDict[b+'_'+a]) name = b+'_'+a;

                if ( edgeDict[name] ) {
                    // check if we've already seen the edge twice
                    if (edgeDict[name].front == edgeDict[name].back) {
                        edgeDict[name].manifold = false;
                        return;
                    }
                    // otherwise flip the appropriate boolean
                    if (isFacing) {
                        edgeDict[name].front = !edgeDict[name].front;
                    } else {
                        edgeDict[name].back = !edgeDict[name].back;
                    }
                    edgeDict[name].manifold = true;
                } else {
                    var verts = !isFacing ? [b, a] : [a, b];
                    edgeDict[a+'_'+b] = {
                        'verts'     : verts,
                        'front'     : isFacing,
                        'back'      : !isFacing,
                        'manifold'  : false
                    };
                }
            },

            /**
             * Adds a triangle to the front and back shadow caps.
             *
             * @param {String} meshID        unique id of mesh
             * @param {[type]} a             vertex of triangle
             * @param {[type]} b             vertex of triangle
             * @param {[type]} c             vertex of triangle
             */
            _addCapTriangle: function( meshID, a, b, c ) {
                // front cap
                var a_front = this._projectVertex(a, this.bias);
                var b_front = this._projectVertex(b, this.bias);
                var c_front = this._projectVertex(c, this.bias);
                this._addTriangle(meshID, a_front, b_front, c_front);

                // back cap
                var a_back = this._projectVertex(a, this.far);
                var b_back = this._projectVertex(b, this.far);
                var c_back = this._projectVertex(c, this.far);
                this._addTriangle(meshID, a_back, c_back, b_back);
            },

            /**
             * Adds two triangles defining the rectangular shadow side abcd.
             *
             * @param {String} meshID               unique id of mesh
             * @param {THREE.Vector3} a             vertex of rectangle
             * @param {THREE.Vector3} b             vertex of rectangle
             * @param {THREE.Vector3} c             vertex of rectangle
             * @param {THREE.Vector3} d             vertex of rectangle
             */
            _addQuad: function ( meshID, a, b, c, d ) {
                this._addTriangle(meshID, a, b, c);
                this._addTriangle(meshID, d, c, b);
            },

            /**
             * Adds the vertices and approrpiate face to shadow volume.
             *
             * @param {String} meshID               unique id of mesh
             * @param {THREE.Vector3} a             vertex of triangle
             * @param {THREE.Vector3} b             vertex of triangle
             * @param {THREE.Vector3} c             vertex of triangle
             */
            _addTriangle: function ( meshID, a, b, c ) {
                this.meshes[meshID].vertices.push(a);
                this.meshes[meshID].vertices.push(b);
                this.meshes[meshID].vertices.push(c);
                var l = this.meshes[meshID].vertices.length;
                this.meshes[meshID].faces.push(new THREE.Face3(l-3, l-2, l-1));
            },


            // PUBLIC FUNCTIONS

            /**
             * Calculates shadow volume if not yet calculated, returns volume
             *
             * @param  {THREE.Mesh} mesh     position of the light
             * @return {THREE.Mesh}          a mesh representing the shadow volume
             */
            getShadowVolume: function ( mesh ) {
                if (!this.meshes[mesh.uuid]) {
                    this._addMesh(mesh);
                    this._computeShadowVolume(mesh.uuid);
                }

                return this.meshes[mesh.uuid].volume;
            },

            /**
             * Recalculates a shadow volume (used when light or geometry changes)
             *
             * @param  {THREE.Mesh} mesh     mesh casting the shadow
             * @return {THREE.Mesh}          a mesh representing the shadow volume
             */
            updateShadowVolume: function ( mesh ) {
                mesh.updateMatrixWorld(true);
                this.meshes[mesh.uuid].matrixWorld = mesh.matrixWorld;
                this.meshes[mesh.uuid].normalMatrix.getNormalMatrix(mesh.matrixWorld);

                this._addGeometry( mesh );
                this._computeShadowVolume( mesh.uuid );
                return this.meshes[mesh.uuid].volume;
            },

            /**
             * Updates the position of the light
             *
             * @param  {THREE.Vector3} position     position of the light
             */
            updateLight: function ( position ) {
                this.origin = position;
            }
        };

})(THREE);