var FluxViewport = (function () {
  'use strict';

  var __commonjs_global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
  function __commonjs(fn, module) { return module = { exports: {} }, fn(module, module.exports, __commonjs_global), module.exports; }

  /**
   * Whether to draw edges on front and back faces
   */
  EdgesHelper.EDGES_MODES = {
      NONE: 0,
      FRONT: 1,
      BACK: 2,
      BOTH: 3
  };

  /**
   * Create an object to render the edges of a mesh
   * @param  {Three.Mesh} mesh            The mesh to convert
   * @param  {Three.Material} material    The material on the mesh
   * @return {Three.EdgesHelper}          The edges object
   */
  var createEdges = function(mesh, material) {
      var helper = new THREE.EdgesHelper(mesh);
      helper.material = material;
      helper.matrixAutoUpdate = false;
      helper.matrix = mesh.matrix;
      return helper;
  };

  /**
   * Create an object to render a mesh as edges
   * @param  {Three.Object3D} model The mesh
   */
  function EdgesHelper(model) {
      THREE.Object3D.call( this );
      this.type = 'EdgesHelper';

      this.frontMaterial = new THREE.LineBasicMaterial({color: 0x000000});
      this.frontMaterial.depthFunc = THREE.LessEqualDepth;

      this.backMaterial = new THREE.LineBasicMaterial({color: 0x000000});
      this.backMaterial.transparent = true;
      this.backMaterial.depthFunc = THREE.GreaterDepth;
      this.backMaterial.opacity = 0.25;

      var _this = this;
      model.traverse(function(child) {
          if (child instanceof THREE.Mesh) {
              // create edge helper for front and back edges
              _this.add(
                  createEdges(child, _this.frontMaterial)
              );
              _this.add(
                  createEdges(child, _this.backMaterial)
              );
          }
      });
  }

  EdgesHelper.prototype = Object.create( THREE.Object3D.prototype );
  EdgesHelper.prototype.constructor = EdgesHelper;

  /**
   * Create the edges geometry for a model
   * @param {THREE.Object3D} newModel The model with edges
   * @param {EdgesHelper.EDGES_MODES} edgesMode Whether to draw edges enumeration
   * @return {EdgesHelper} The edges object
   */
  EdgesHelper.AddEdges = function(newModel, edgesMode) {
      if (edgesMode === EdgesHelper.EDGES_MODES.NONE) return null;

      newModel.edgesHelper = new EdgesHelper(newModel);

      newModel.edgesHelper.frontMaterial.visible = false;
      if (edgesMode === EdgesHelper.EDGES_MODES.FRONT || edgesMode === EdgesHelper.EDGES_MODES.BOTH) {
          newModel.edgesHelper.frontMaterial.visible = true;
      }

      newModel.edgesHelper.backMaterial.visible = false;
      if (edgesMode === EdgesHelper.EDGES_MODES.BACK || edgesMode === EdgesHelper.EDGES_MODES.BOTH) {
          newModel.edgesHelper.backMaterial.visible = true;
      }
      return newModel.edgesHelper;
  };

  function FluxCameras(width, height) {
      // Initialize default cameras and frustums.
      this._perspCamera = new THREE.PerspectiveCamera(30, width/height, 0.1, 100000);
      // Flux is Z up
      this._perspCamera.up = new THREE.Vector3( 0, 0, 1 );

      this._orthoCamera = new THREE.OrthographicCamera(100, -100, 100, -100, -1000, 1000);

      this.setView(FluxCameras.VIEWS.perspective);
      this.updateCamera(width, height);
  }

  /**
   * Enumeration of all possible views for the camera
   * @type {Object}
   */
  FluxCameras.VIEWS = {
      perspective:  0,
      top:    1,
      bottom: 2,
      front:  3,
      back:   4,
      right:  5,
      left:   6,
      END:   7
  };

  /**
   * Get the current camera object
   * @return {THREE.Camera} The current camera
   */
  FluxCameras.prototype.getCamera = function () {
      if (this._view === FluxCameras.VIEWS.perspective) {
          return this._perspCamera;
      }
      return this._orthoCamera;
  };

  FluxCameras.DEFAULT_POSITIONS = [
      [2500000, 1000000, 1300000], // perspective
      [0, 0, -100], // top
      [0, 0, 100], // bottom
      [0, 0, 0], // front
      [0, 0, 0], // back
      [0, 0, 0], // right
      [0, 0, 0] // left
  ];

  FluxCameras.DEFAULT_ROTATIONS = [
      [0, 0, 0], // perspective
      [0, 0, 0], // top
      [0, Math.PI, 0], // bottom
      [Math.PI/2, Math.PI/2, 0], // front
      [Math.PI/2, -Math.PI/2, 0], // back
      [Math.PI/2, 0, 0], // right
      [Math.PI/2, Math.PI, 0] // left
  ];

  FluxCameras.isValidView = function (view) {
      return view != null && view.constructor === Number && view > -1 && view < FluxCameras.VIEWS.END;
  };

  /**
   * Set the camera to the default coordinates for the given view.
   * @param {FluxCameras.VIEWS} view The new view
   */
  FluxCameras.prototype.setView = function (view) {
      if (!FluxCameras.isValidView(view)) return;
      this._view = view;

      var camera = this.getCamera();
      camera.position.set(FluxCameras.DEFAULT_POSITIONS[view][0],
                          FluxCameras.DEFAULT_POSITIONS[view][1],
                          FluxCameras.DEFAULT_POSITIONS[view][2]);

      camera.rotation.set(FluxCameras.DEFAULT_ROTATIONS[view][0],
                          FluxCameras.DEFAULT_ROTATIONS[view][1],
                          FluxCameras.DEFAULT_ROTATIONS[view][2]);
  };

  /**
   * Recompute derived state when the camera is changed.
   * @param  {Number} width  Width of the viewport (used to calculate aspect ratio)
   * @param  {Number} height Height of the viewport (used to calculate aspect ratio)
   */
  FluxCameras.prototype.updateCamera = function(width, height) {
      this._perspCamera.aspect = width / height;
      this._perspCamera.updateProjectionMatrix();

      var a = width / height;
      var h = this._orthoCamera.top - this._orthoCamera.bottom;
      this._orthoCamera.top = h / 2;
      this._orthoCamera.bottom = - h / 2;
      this._orthoCamera.right = h / 2 * a;
      this._orthoCamera.left = - h / 2 * a;
      this._orthoCamera.updateProjectionMatrix();
  };

  /**
   * Extract only relevant properties from a camera
   * @param  {THREE.Camera} camera The camera source
   * @return {Object}        The camera data
   */
  FluxCameras.cameraToJSON = function(camera) {
      var serializableCamera = {
          px: camera.position.x,
          py: camera.position.y,
          pz: camera.position.z,
          rx: camera.rotation.x,
          ry: camera.rotation.y,
          rz: camera.rotation.z,
          near: camera.near,
          far: camera.far
      };
      // Handle extra OrthographicCamera properties
      if (camera instanceof THREE.OrthographicCamera) {
          serializableCamera.top = camera.top;
          serializableCamera.right = camera.right;
          serializableCamera.bottom = camera.bottom;
          serializableCamera.left = camera.left;
          serializableCamera.type = 'orthographic';
      } else {
          serializableCamera.type = 'perspective';
      }
      return serializableCamera;
  };

  /**
   * Check if something is anumber
   * @param {Number} num The value
   * @returns {boolean} True for numbers
   * @private
   */
  function _isNumber(num) {
      return num != null && num.constructor === Number;
  }

  /**
   * Check whether a set of properties are valid numbers
   * @param {Array.<string>} schema The list of properties
   * @param {Object} data The object with properties
   * @returns {boolean} True if all numbers
   * @private
   */
  function _checkNumbers(schema, data) {
      // Make sure all the properties are valid and exist
      for (var i=0;i<schema.length;i++) {
          if (!_isNumber(data[schema[i]])) {
              return false;
          }
      }
      return true;
  }

  /**
   * Rehydrate camera instance from an object property tree.
   * @param  {THREE.camera} camera The camera to receive data
   * @param  {Object} data   The data to parse and apply
   */
  FluxCameras.cameraFromJSON = function(camera, data) {
      var schema = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'near', 'far'];
      if (!_checkNumbers(schema, data)) return;
      camera.position.x = data.px;
      camera.position.y = data.py;
      camera.position.z = data.pz;
      camera.rotation.x = data.rx;
      camera.rotation.y = data.ry;
      camera.rotation.z = data.rz;
      camera.near = data.near;
      camera.far = data.far;

      // Handle extra OrthographicCamera properties
      if (camera.constructor === THREE.OrthographicCamera) {
          schema = ['top', 'right', 'bottom', 'left'];
          if (!_checkNumbers(schema, data)) return;
          camera.top = data.top;
          camera.right = data.right;
          camera.bottom = data.bottom;
          camera.left = data.left;
      }
  };

  /**
   * Make serializable by pruning all references and building an object property tree
   * @return {Object} The simplified model
   */
  FluxCameras.prototype.toJSON = function() {
      var serializableCameras = {
          perspective: FluxCameras.cameraToJSON(this._perspCamera),
          orthographic: FluxCameras.cameraToJSON(this._orthoCamera),
          view: this._view
      };
      return serializableCameras;
  };

  /**
  * Update the corresponding cameras in this object from a serialized object.
  * @param  {Object} serializableCameras The camera data to use.
  */
  FluxCameras.prototype.fromJSON = function(serializableCameras) {
      this.setView(serializableCameras.view);
      FluxCameras.cameraFromJSON(this._perspCamera, serializableCameras.perspective);
      FluxCameras.cameraFromJSON(this._orthoCamera, serializableCameras.orthographic);
  };

  /**
   * Manages reference objects that render in the scene.
   * Geometry in this object has depth write disabled since it is meant to be
   * layered onto the scene as a second pass. This allows the text on the labels
   * to render correctly and prevents flickering from z-fighting between the grid
   * and the axis lines.
   */
  function FluxHelpers() {
      THREE.Object3D.call( this );
      this.type = 'FluxHelpers';

      this._grid = this._setupGrid(10, 10, 0x111111, 0xaaaaaa);
      this.setView(FluxCameras.VIEWS.perspective);
      this.add(this._grid);

      this._axis = this._setupAxis();
      this.add(this._axis);
  }

  FluxHelpers.prototype = Object.create( THREE.Object3D.prototype );
  FluxHelpers.prototype.constructor = FluxHelpers;

  /**
   * Create a grid of lines to give the user a sense of scale.
   * This is also referred to as a construction plane.
   * @param  {Number} size   Size of grid spacing
   * @param  {Number} width  Width of grid spacing
   * @param  {Number|String} color1 Color specification for primary grid color
   * @param  {Number|String} color2 Color specification for secondary grid color
   * @return {Object3D}        The grid object
   */
  FluxHelpers.prototype._setupGrid = function(size, width, color1, color2) {
      var grid = new THREE.GridHelper(size * width, size);
      grid.setColors(new THREE.Color(color1), new THREE.Color(color2));
      grid.material.transparent = true;
      grid.material.opacity = 0.5;
      grid.material.depthWrite = false;
      return grid;
  };

  /**
   * Setup the coordinate axis with xyz labels
   * @return {THREE.Object3D} The axis object
   */
  FluxHelpers.prototype._setupAxis = function() {
      var axis = new THREE.AxisHelper(10);
      axis.traverse(function(child) {
          if (child.material ) {
              child.material.depthWrite = false;
          }
      });
      return axis;
  };

  /**
   * Adjust the orientation of the grid to match the camera.
   * This keeps it aligned to screen space.
   * @param {FluxCameras.VIEWS} view Which view to orient to
   */
  FluxHelpers.prototype.setView = function(view) {
    switch (view) {
      case FluxCameras.VIEWS.perspective:
      case FluxCameras.VIEWS.top:
      case FluxCameras.VIEWS.bottom:
          // facing Z
          this._grid.rotation.set(Math.PI / 2, 0, 0);
          break;
      case FluxCameras.VIEWS.front:
      case FluxCameras.VIEWS.back:
          // facing X
          this._grid.rotation.set(0, 0, Math.PI / 2);
          break;
      case FluxCameras.VIEWS.right:
      case FluxCameras.VIEWS.left:
          // facing Y
          this._grid.rotation.set(0, 0, 0);
          break;
    }
  };

  /**
  * Class to represent a WebGL context which can render for multiple viewports
  */
  function FluxRenderContext () {
      /**
      * Pointer to the shared THREE.js renderer
      */
      try {
          this._hasWebGL = true;
          this.renderer = new THREE.WebGLRenderer({
              antialias: true,
              preserveDrawingBuffer: true,
              alpha: false
          });
          this.renderer.autoClear = false;
          this.renderer.autoClearStencil = false;
          this.renderer.gammaInput = false;
          this.renderer.gammaOutput = false;
          // Allow interactive canvas to overlap other canvas
          this.renderer.domElement.style.position = "absolute";
      } catch (err) {
          // Replace renderer with mock renderer for tests
          this.renderer = {
              render: function () {},
              setSize: function () {},
              clear: function () {},
              setViewport: function () {},
              setClearColor: function () {},
              getSize: function () { return {width: 100, height: 100}; },
              getPixelRatio: function () { return 1; },
              domElement: document.createElement('div')
          };
          this._hasWebGL = false;
      }
      /**
      * Pointer to the three-viewport-renderer instance that is currently being rendered.
      */
      this.currentHost = null;
  }

  /**
  * Maximum number of WebGL contexts allowed.
  * Should be less than or equal to 16, the limit on recent systems.
  */
  FluxRenderContext.MAX_CONTEXTS = 16;

  // List of all render contexts shared globally
  FluxRenderContext.contexts = [];

  // Counter so new viewports know which context to create or reuse.
  FluxRenderContext.nextContext = 0;

  /**
  * Each viewport uses the next available render context defined by this function
  * @return {[type]} [description]
  */
  FluxRenderContext.getNextContext = function () {
      var i = FluxRenderContext.nextContext;
      FluxRenderContext.nextContext += 1;
      FluxRenderContext.nextContext = FluxRenderContext.nextContext % FluxRenderContext.MAX_CONTEXTS;
      return FluxRenderContext.contexts[i];
  };

  FluxRenderContext.getNewContext = function () {
      var context;
      if (FluxRenderContext.contexts.length >= FluxRenderContext.MAX_CONTEXTS) {
          context = FluxRenderContext.getNextContext();
      } else {
          context = new FluxRenderContext();
          FluxRenderContext.contexts.push(context);
      }
      return context;
  };

  FluxRenderContext.prototype.hasWebGL = function() {
      return this._hasWebGL;
  };

  // Multipass Variables (private, singleton)
  // Material that writes depth to pixels
  var DEPTH_MATERIAL = new THREE.ShaderMaterial( {
      uniforms: THREE.UniformsUtils.clone( THREE.ShaderLib.depthRGBA.uniforms ),
      fragmentShader: THREE.ShaderLib.depthRGBA.fragmentShader,
      vertexShader: THREE.ShaderLib.depthRGBA.vertexShader,
      blending: THREE.NoBlending
  } );

  // Material that writes normal to pixels
  var NORMAL_MATERIAL = new THREE.MeshNormalMaterial();

  // Used for debugging issues with _setHost
  FluxRenderer.nextId = 0;

  /**
   * Class wrapping the renderer with custom passes and context swapping.
   *
   * Multipass rendering uses GPU shaders to accomplish ambient obscurance
   * and stencil buffer shadows.
   *
   * Context swapping lets a single OpenGL context and canvas be used for multiple renderers.
   *
   * @param {Element} domParent The div container for the canvas
   * @param {Number} width     The width of the canvas
   * @param {Number} height    The height of the canvas
   */
  function FluxRenderer(domParent, width, height) {
      this.id = FluxRenderer.nextId++;

      // Dom element that wraps the canvas
      this._domParent = domParent;

      // Determines if multipass rendering (THREE.EffectsComposer) is used
      this._multipass = false;

      // TODO: Convert this to a list of passes rather than individual bools
      // Determines if ambient occlusion is used (requires multipass to be true)
      this._showOcclusion = true;

      // Determines if stencilbuffer shadows are used (requires multipass)
      this._showShadows = false;

      // Current three.js geometry to render
      this._model = null;

      // The object containing the lights in the scene
      this._lights = null;

      // The context that contains the renderer and corresponds to a canvas
      // Create renderer for the first time.
      this._context = FluxRenderContext.getNewContext();

      // EffectComposer object, used in multipass rendering
      this._composer = new THREE.EffectComposer(this._context.renderer);

      this._width = width;
      this._height = height;

      this._createCacheCanvas(width, height);

      this.setClearColor(0xC5CDCC);

      this._cameras = new FluxCameras(width, height);
      this._helpers = new FluxHelpers();
      this._helpersScene = new THREE.Scene();
      this._helpersScene.add(this._helpers);

      // Camera to be rendered with.Any instance of `THREE.Camera` can be set here.
      this._initControls();

      // Scene containing geometry to be rendered in this viewport THREE.Scene
      this._scene = new THREE.Scene();
      // this._scene.add(this._helpers);

      // Fog object for this viewport constructed from color and density
      this._fog = new THREE.FogExp2( this._clearColor, 0.0 );
      this._scene.fog = this._fog;

      // Scene containing edges geometry for hidden line rendering
      this._edgesScene = new THREE.Scene();
      this._edgesMode = EdgesHelper.EDGES_MODES.NONE;

      // variables for stencilbuffer shadows
      // Scene holding shadow volumes = THREE.Scene
      this._shadowScene = new THREE.Scene();
      // Color of shadows (multiplied with ground) @type {THREE.Color}
      this._shadowColor = new THREE.Color(0.08, 0.0, 0.2);
      // Alpha opacity of shadow, where 1.0 is completely opaque
      this._shadowAlpha = 0.35;
      this._shadowBuilder = new THREE.ShadowBuilder(this._shadowLight);

      this._addPasses();
  }

  FluxRenderer.prototype = Object.create( THREE.EventDispatcher.prototype );
  FluxRenderer.prototype.constructor = FluxRenderer;

  /**
   * Name of the event fired when the camera changes
   * @type {String}
   */
  FluxRenderer.CHANGE_EVENT = 'change';

  /**
   * Set the lights used to illuminate the scene.
   * @param {THREE.Object3D} lights Object with lights as children
   */
  FluxRenderer.prototype.setLights = function(lights) {
      if (this._lights) {
          this._scene.remove(this._lights);
      }
      this._lights = lights;
      this._scene.add(this._lights);
  };

  /**
   * Remove the geometry objects from the THREE registry so they can be garbage collected
   * @param  {THREE.Object3D} obj The object being removed
   */
  function _removeGeometries(obj) {
      if (obj.geometry) {
          obj.geometry.dispose();
      }
  }

  /**
   * Remove an object from the scene and clean up memory
   * @param  {THREE.Scene} scene Scene containing the model
   * @param  {THREE.Object3D} model The geometry to remove
   */
  function _deleteFromScene(scene, model) {
      if (!model || !scene) return;
      scene.remove(model);
      model.traverse(_removeGeometries);
  }

  /**
   * Set the object to render
   * Replaces old render contents
   * @param {THREE.Object3D} model What to render
   */
  FluxRenderer.prototype.setModel = function(model) {
      if (this._model) {
          _deleteFromScene(this._scene, this._model);
          _deleteFromScene(this._edgesScene, this._model.edgesHelper);
      }
      this._model = model;
      if (this._model) {
          this._scene.add(this._model);
          if (EdgesHelper.AddEdges(this._model, this._edgesMode)) {
              this._edgesScene.add(this._model.edgesHelper);
          }
      }
  };

  /**
   * Set the edges rendering mode for hidden line rendering
   * @param  {EdgesHelper.EDGES_MODES} mode Whether to render front, back, both or none
   */
  FluxRenderer.prototype.setEdgesMode = function(mode) {
      this._edgesMode = mode;
  };

  /**
   * When the camera controls change make sure to update the camera
   */
  FluxRenderer.prototype._initControls = function() {
      if (this._controls) this._controls.enabled = false;
      //TODO(Kyle): rewrite EditorControls to allow camera to be changed
      this._controls = new THREE.EditorControls(this._cameras.getCamera(), this._domParent);
      var _this = this;
      this._controls.addEventListener(FluxRenderer.CHANGE_EVENT, function(event) {
          _this._cameras.updateCamera(_this._width, _this._height);
          _this.dispatchEvent( event );
      });
  };

  /**
   * Restore the camera to a default location
   */
  FluxRenderer.prototype.homeCamera = function() {
      this._controls.focus(this._helpers, true);
  };

  /**
  * Focus the controls' current camera on an object.
  * This function will focus on the union of object and all of it's visible children.
  * @param  {THREE.Object3D} object The scene object to focus on.
  */
  FluxRenderer.prototype.focus = function() {
      if (!this._model) return;
      this._controls.focus(this._model, true);
      // Changing the controls here triggers a render
  };

  /**
   * Set the clear color (background) for WebGL canvas
   * @param {String|Number} color Hexadecimal or a CSS-style string
   */
  FluxRenderer.prototype.setClearColor = function(color) {
      this._clearColor = new THREE.Color(color);
  };

  /**
   * Set up a new canvas used for storing a cached image.
   * The cache image is populated when this renderer loses it's context.
   * @param {Number} width The width of the canvas
   * @param {Number} height The height of the canvas
   */
  FluxRenderer.prototype._createCacheCanvas = function(width, height) {
      if (this._cacheCanvas) return;
      // The canvas used to store a cached image of the previous render when all the WebGL contexts are in use with other renderers
      this._cacheCanvas = document.createElement('canvas');
      this._cacheCanvas.width = width;
      this._cacheCanvas.height = height;
      this._cacheCanvas.style.position = 'absolute';
      this._cacheCanvas.style['user-select'] = 'none';
      this._cacheCanvas.style['-webkit-user-select'] = 'none';
      this._domParent.appendChild(this._cacheCanvas);

      // Canvas2D used to store framebuffer pixels after renderer.domElement migration.
      this.ctx = this._cacheCanvas.getContext('2d');
  };

  /**
   * Destructor to prevent future rendering after being unloaded
   */
  FluxRenderer.prototype.detach = function() {
      if (this._context && this._context.currentHost === this) {
          this._context.currentHost = null;
      }
  };

  /**
   * Change the camera view
   * @param {String} view The new view mode
   */
  FluxRenderer.prototype.setView = function(view) {
      this._cameras.setView(view);
      this._cameras.updateCamera(this._width, this._height);
      this._initControls();
      this._helpers.setView(view);

      if (!this._renderPasses) return;
      this._renderPasses.renderPass.camera = this._cameras.getCamera();
      this._renderPasses.edgesPass.camera = this._cameras.getCamera();
      this._renderPasses.helperPass.camera = this._cameras.getCamera();
      this._renderPasses.stencilPass.camera = this._cameras.getCamera();
  };

  /**
  * Creates depth, normal materials and depth, normal render targets.
  */
  FluxRenderer.prototype._addRenderTargets = function() {
      // depth render target (uses THREE.js depth shader)
      this._depthTarget = new THREE.WebGLRenderTarget(
          window.innerWidth, //TODO(kyle) Why does this use window!?
          window.innerHeight,
          {
              minFilter: THREE.NearestFilter,
              magFilter: THREE.NearestFilter,
              format: THREE.RGBAFormat
          }
      );

      // normal render target
      this._normalTarget = this._depthTarget.clone();
  };

  /**
  * Adds enabled passes to the EffectComposer
  *
  * Always begins with a render pass
  * Always ends with an antialiasing (FXAA) pass
  *
  * May include the following: Ambient occlusion, Shadows
  */
  FluxRenderer.prototype._addPasses = function() {
      // _renderPasses dictionary for holding passes that need to be accessed or modified
      this._renderPasses = {};
      this._addRenderTargets();

      // diffuse render pass
      var renderPass = new THREE.RenderPass(this._scene, this._cameras.getCamera());
      this._composer.addPass(renderPass);
      this._renderPasses.renderPass = renderPass;

      var edgesPass = new THREE.RenderPass(this._edgesScene, this._cameras.getCamera());
      edgesPass.clear = false;
      this._composer.addPass(edgesPass);
      edgesPass.polygonOffset = true;
      edgesPass.enabled = !!this._edgesScene;
      this._renderPasses.edgesPass = edgesPass;

      // helper render pass
      var helperPass = new THREE.RenderPass(this._helpersScene, this._cameras.getCamera());
      helperPass.clear = false;
      this._composer.addPass(helperPass);
      this._renderPasses.helperPass = helperPass;
      helperPass.enabled = true;

      // ambient occlusion pass
      var aoPass = new THREE.ShaderPass(THREE.SAOShader);
      // set uniform vars for ao pass
      aoPass.uniforms.tDepth.value = this._depthTarget;
      aoPass.uniforms.tNorm.value = this._normalTarget;
      aoPass.uniforms.projInv.value = new THREE.Matrix4();//TODO.getInverse(this._cameras.getCamera().projectionMatrix);
      aoPass.uniforms.onlyAO.value = false; // set to true to view only ambient occlusion
      aoPass.clear = true;
      aoPass.needsSwap = true;
      this._renderPasses.aoPass = aoPass;
      this._composer.addPass(aoPass);

      // stencil buffer shadow passes
      var copyPass = new THREE.ShaderPass( THREE.CopyShader );
      copyPass.needsSwap = false;
      this._composer.addPass( copyPass ); // copy AO to write buffer
      this._renderPasses.copyPass = copyPass;

      var stencilPass = new THREE.StencilPass( this._shadowScene, this._cameras.getCamera());
      this._composer.addPass( stencilPass ); // render shadow volumes to stencilbuffer
      this._renderPasses.stencilPass = stencilPass;

      var darkenPass = new THREE.ShaderPass( THREE.DarkenShader );
      darkenPass.uniforms.alpha.value = this._shadowAlpha;
      darkenPass.uniforms.color.value = new THREE.Vector3(this._shadowColor.r, this._shadowColor.g, this._shadowColor.b);
      darkenPass.needsSwap = false;
      this._composer.addPass( darkenPass ); // darken stencil areas
      this._renderPasses.darkenPass = darkenPass;

      var clearPass = new THREE.ClearStencilPass();
      clearPass.needsSwap = true;
      this._composer.addPass( clearPass ); // clear stencil
      this._renderPasses.clearPass = clearPass;

      // fast approximate antialiasing pass
      var FXAAPass = new THREE.ShaderPass(THREE.FXAAShader);
      FXAAPass.renderToScreen = true;
      this._renderPasses.FXAAPass = FXAAPass;
      this._composer.addPass(FXAAPass);
  };

  /**
  * For multipass rendering, update which render passes are enabled.
  * Based on user preferences some passes may be turned on or off.
  * Also passes may be disabled if the corresponding scene is empty.
  */
  FluxRenderer.prototype._updatePasses = function () {
      if (this._showOcclusion) {
          // populate depth target
          this._scene.overrideMaterial = DEPTH_MATERIAL;
          this._context.renderer.clearTarget( this._depthTarget, true, true );
          this._context.renderer.render( this._scene, this._cameras.getCamera(), this._depthTarget );

          // populate normal target (set clearColor to (0,0,0) since
          // empty pixels do not have normals)
          this._context.renderer.setClearColor( 0x000000 );
          this._scene.overrideMaterial = NORMAL_MATERIAL;
          this._context.renderer.clearTarget( this._normalTarget, true, true );
          this._context.renderer.render( this._scene, this._cameras.getCamera(), this._normalTarget );
          this._scene.overrideMaterial = null;
          this._context.renderer.setClearColor( this._clearColor );

          // update ambient occlusion shader uniforms
          var projInv = new THREE.Matrix4();
          projInv.getInverse(this._cameras.getCamera().projectionMatrix);
          this._renderPasses.aoPass.uniforms.projInv.value = projInv;
          this._renderPasses.aoPass.uniforms.size.value.set(this._width, this._height);
          this._renderPasses.aoPass.uniforms.onlyDiffuse.value = false;
      } else {
          this._renderPasses.aoPass.uniforms.onlyDiffuse.value = true;
      }

      if (this._showShadows) {
          this._composer.renderTarget1.stencilBuffer = true;
          this._composer.renderTarget2.stencilBuffer = true;
          this._renderPasses.copyPass.enabled = true;
          this._renderPasses.stencilPass.enabled = true;
          this._renderPasses.darkenPass.enabled = true;
          this._renderPasses.clearPass.enabled = true;
      } else {
          this._composer.renderTarget1.stencilBuffer = false;
          this._composer.renderTarget2.stencilBuffer = false;
          this._renderPasses.copyPass.enabled = false;
          this._renderPasses.stencilPass.enabled = false;
          this._renderPasses.darkenPass.enabled = false;
          this._renderPasses.clearPass.enabled = false;
      }

      // set antialiasing 'resolution' uniform to current screen resolution
      this._renderPasses.FXAAPass.uniforms.resolution.value.set(1.0/this._width, 1.0/this._height);
  };

  /**
  * Render the scene with its geometry.
  */
  FluxRenderer.prototype.doRender = function () {
      this._setHost();
      this._update();
      this._context.renderer.clear();
      if (this._multipass) {
          this._updatePasses();
          // render scene
          this._composer.render();
      } else {
          this._context.renderer.render(this._scene, this._cameras.getCamera());
          this._context.renderer.render(this._edgesScene, this._cameras.getCamera());
          this._context.renderer.render(this._helpersScene, this._cameras.getCamera());
      }
  };

  /**
   * Say whether there are any objects to render in the model
   * @return {Boolean} True if there are objects to render
   */
  FluxRenderer.prototype.anyValidPrims = function() {
      return this._model ? this._model.children.length > 0 : false;
  };

  /**
  * Set the light that is casting shadows.
  * @param {THREE.Light} light      light object, position is saved
  */
  FluxRenderer.prototype.setShadowLight = function(light) {
      // Enable shadows on this renderer
      this._multipass = true;
      this._showShadows = true;

      this._shadowLight = light.position;
      this._shadowBuilder.updateLight(light.position);
  };

  /**
   * Add the shadows for everything in the current model
   */
  FluxRenderer.prototype.addShadows = function() {
      var _this = this;
      this._model.traverse(function (obj) {
          if (obj && obj.geometry) {
              _this.addShadow(obj);
          }
      });
  };
  /**
  * Add a shadow to the scene.
  * @param {THREE.Mesh} mesh        The mesh of the object casting a shadow
  */
  FluxRenderer.prototype.addShadow = function(mesh) {
      var shadow = this._shadowBuilder.getShadowVolume(mesh);
      this._shadowScene.add(shadow);
  };

  /**
  * Remove a shadow from the scene.
  * @param  {THREE.Mesh} mesh       The mesh of the shadow to remove
  */
  FluxRenderer.prototype.removeShadow = function(mesh) {
      var shadow = this._shadowBuilder.getShadowVolume(mesh);
      this._shadowScene.remove(shadow);
  };

  /**
   * Copy the image that is in the render canvas to this renderer's cache canvas.
   * This allows the rendered image to persist even when the renderer is not available.
   * This happens when the user moves the mouse away from this viewport to another one.
   */
  FluxRenderer.prototype._cacheImageToCanvas = function () {
      this.doRender();
      this.ctx.drawImage(this._context.renderer.domElement, 0, 0, this._cacheCanvas.width, this._cacheCanvas.height);
  };

  /**
   * Get the canvas for use in QA scripts
   * @return {Canvas} WebGL canvas dom element
   */
  FluxRenderer.prototype.getGlCanvas = function() {
      return this._context.renderer.domElement;
  };

  /**
  * Migrate renderer.domElement to this host if necessary
  * and copy framebuffer into Canvas2D element of the previous host.
  */
  FluxRenderer.prototype._setHost = function() {
      if (this === this._context.currentHost) return;
      if (this._context.currentHost) {
          // Copy the image from domElement (THREE's interactive canvas)
          // to the 2D context for this element's canvas
          // This image will remain up until the user interacts with the old viewport again
          this._context.currentHost._cacheImageToCanvas();
      }
      this._context.currentHost = this;
      this.setSize(this._width, this._height);
      // Move the THREE.WebGLRenderer's canvas under the new host
      this._domParent.appendChild(this._context.renderer.domElement);
  };

  /**
   * Set the WebGLRenderer parameters to match this renderer.
   */
  FluxRenderer.prototype._update = function() {
      this._context.renderer.autoClearColor = this._multipass;
      this._context.renderer.autoClearDepth = this._multipass;
      this._context.renderer.setSize(this._width, this._height);
      this._context.renderer.setClearColor(this._clearColor);
  };

  /**
   * Set the size of things that are per viewport.
   * @param {Number} width  The canvas width in pixels
   * @param {Number} height The canvas height in pixels
   */
  FluxRenderer.prototype.setSize = function(width, height) {
      if (width <= 0 || height <= 0 || (width === this._width && height === this.height)) return;
      this._width = width;
      this._height = height;

      this._cameras.updateCamera(this._width, this._height);

      this._composer.setSize(this._width, this._height);

      this._cacheCanvas.height = height;
      this._cacheCanvas.width = width;
  };

  /**
   * Make serializable by pruning all references and building an object property tree
   * @return {Object} Data to stringify
   */
  FluxRenderer.prototype.toJSON = function() {
      var serializableState = {
          cameras: this._cameras.toJSON(), // camera pos and view
          controls: this._controls.toJSON() // center point
      };
      return serializableState;
  };

  /**
   * Take a data object and use it to update the internal state
   * @param  {Object} state The properties to set
   */
  FluxRenderer.prototype.fromJSON = function(state) {
      if (!state) return;
      if (state.cameras != null) {
          this.setView(state.cameras.view);
          this._cameras.fromJSON(state.cameras);
      }
      if (state.controls) {
          this._controls.fromJSON(state.controls);
      }
  };

  var fluxJsonToThree_common = __commonjs(function (module, exports, global) {
  'use strict';

  var __commonjs_global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : __commonjs_global;
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
   * @param {String} primitive The name of the entity type
   * @returns {{func: *, material: number}} A function to convert a prim to geomtry and a material type
   */
  function resolveType (primitive) {

      var primFunction = primitiveHelpers[ primitive ];
      var materialType = MATERIAL_TYPES.PHONG;
      if (primitive === 'point') {
          materialType = MATERIAL_TYPES.POINT;
      }

      if (!primFunction) {
          primFunction = wirePrimitives[ primitive ];
          materialType = MATERIAL_TYPES.LINE;
      }
      if (!primFunction) {
          primFunction = sheetPrimitives[ primitive ];
          materialType = MATERIAL_TYPES.PHONG;
      }
      if (!primFunction) {
          primFunction = solidPrimitives[ primitive ];
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
                          Object.keys(wirePrimitives));
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
  var scene = {"type":"object","properties":{"Entities":{"$ref":"#/scene/entities"},"Operations":{"$ref":"#/scene/operations"}},"required":["Entities","Operations"],"additionalProperties":false,"operations":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"op":{"$ref":"#/scene/operation"}},"additionalProperties":false}},"operation":{"oneOf":[{"type":"boolean"},{"type":"number"},{"type":"string"},{"type":"array","items":[{"type":"string"}],"minItems":1,"additionalItems":{"$ref":"#/scene/operation"}}]},"entities":{"type":"object","minProperties":1,"items":{"$ref":"#/scene/entity"}},"entity":{"oneOf":[{"type":"array","items":{"$ref":"#/scene/entity"}},{"oneOf":[{"$ref":"#/entities/empty"},{"$ref":"#/entities/number"},{"$ref":"#/entities/brep"},{"$ref":"#/entities/vector"},{"$ref":"#/entities/point"},{"$ref":"#/entities/point-2d"},{"$ref":"#/entities/plane"},{"$ref":"#/entities/affineTransform"},{"$ref":"#/entities/massProps"},{"$ref":"#/entities/line"},{"$ref":"#/entities/polyline"},{"$ref":"#/entities/circle"},{"$ref":"#/entities/ellipse"},{"$ref":"#/entities/curve"},{"$ref":"#/entities/arc"},{"$ref":"#/entities/rectangle"},{"$ref":"#/entities/polycurve"},{"$ref":"#/entities/polygonSet"},{"$ref":"#/entities/polygon-set"},{"$ref":"#/entities/surface"},{"$ref":"#/entities/polysurface"},{"$ref":"#/entities/block"},{"$ref":"#/entities/torus"},{"$ref":"#/entities/sphere"},{"$ref":"#/entities/cylinder"},{"$ref":"#/entities/cone"},{"$ref":"#/entities/mesh"}]}]}};
  var types = {"brep_format":{"enum":["x_b","x_t","iges","step","sat","sab","stl"]},"index":{"type":"integer","minimum":0},"index-nonzero":{"type":"integer","minimum":0,"exclusiveMinimum":true},"direction":{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3},"angle":{"type":"number","fluxDimension":"angle"},"coordinate":{"type":"number","fluxDimension":"length"},"distance":{"type":"number","minimum":0,"fluxDimension":"length"},"area":{"type":"number","minimum":0,"fluxDimension":"area"},"volume":{"type":"number","minimum":0,"fluxDimension":"volume"},"distance-nonzero":{"type":"number","minimum":0,"exclusiveMinimum":true,"fluxDimension":"length"},"position":{"type":"array","items":{"$ref":"#/types/coordinate"},"minItems":3,"maxItems":3},"dimensions":{"type":"array","items":{"$ref":"#/types/distance-nonzero"},"minItems":3,"maxItems":3},"units":{"type":"object","additionalProperties":false,"patternProperties":{".*":{"type":"string"}}}};
  var entities = {"empty":{"type":"object","additionalProperties":false},"number":{"type":"number"},"brep":{"type":"object","properties":{"primitive":{"enum":["brep"]},"content":{"type":"string"},"format":{"$ref":"#/types/brep_format"},"isCompressed":{"type":"boolean"},"isBase64":{"type":"boolean"},"vertices":{"type":"array","items":{"$ref":"#/types/position"}},"faces":{"type":"array","items":{"type":"array","items":{"$ref":"#/types/index"},"minItems":3}},"attributes":{}},"required":["primitive","content","format"]},"vector":{"type":"object","properties":{"primitive":{"enum":["vector"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"coords":{"$ref":"#/types/position"}},"required":["primitive","coords"]},"point-2d":{"$ref":"#/entities/point"},"point":{"type":"object","properties":{"primitive":{"enum":["point","point-2d"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"point":{"$ref":"#/types/position"}},"required":["primitive","point"]},"plane":{"type":"object","properties":{"primitive":{"enum":["plane"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"normal":{"$ref":"#/types/direction"}},"required":["primitive","origin","normal"]},"affineTransform":{"type":"object","properties":{"primitive":{"enum":["affineTransform"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"mat":{"type":"array","items":{"type":"number"},"minItems":16,"maxItems":16,"fluxDimension":"affineMatrix"}},"required":["primitive","mat"],"additionalProperties":false},"massProps":{"type":"object","properties":{"primitive":{"enum":["massProps"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"mass":{"$ref":"#/types/distance"},"centerOfMass":{"$ref":"#/types/position"},"inertiaTensor":{"type":"array","items":{"$ref":"#/types/direction"},"minItems":3,"maxItems":3},"volume":{"$ref":"#/types/volume"},"surfaceArea":{"$ref":"#/types/area"},"length":{"$ref":"#/types/distance"},"circumference":{"$ref":"#/types/distance"}},"required":["primitive","mass","centerOfMass","inertiaTensor"],"additionalProperties":false},"line":{"type":"object","properties":{"primitive":{"enum":["line"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"start":{"$ref":"#/types/position"},"end":{"$ref":"#/types/position"}},"required":["primitive","start","end"]},"polyline":{"type":"object","properties":{"primitive":{"enum":["polyline"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"points":{"type":"array","items":{"$ref":"#/types/position"},"minItems":2}},"required":["primitive","points"]},"circle":{"type":"object","properties":{"primitive":{"enum":["circle"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","radius"]},"ellipse":{"type":"object","properties":{"primitive":{"enum":["ellipse"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"majorRadius":{"$ref":"#/types/distance-nonzero"},"minorRadius":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"},"reference":{"$ref":"#/types/direction"}},"required":["primitive","origin","majorRadius","minorRadius"]},"curve":{"type":"object","properties":{"primitive":{"enum":["curve"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"degree":{"$ref":"#/types/index-nonzero"},"controlPoints":{"type":"array","items":{"$ref":"#/types/position"}},"knots":{"type":"array","items":{"type":"number"}},"weights":{"type":"array","items":{"type":"number"}}},"required":["primitive","degree","controlPoints","knots"]},"arc":{"type":"object","properties":{"primitive":{"enum":["arc"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"start":{"$ref":"#/types/position"},"middle":{"$ref":"#/types/position"},"end":{"$ref":"#/types/position"}},"required":["primitive","start","middle","end"]},"rectangle":{"type":"object","properties":{"primitive":{"enum":["rectangle"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"dimensions":{"type":"array","items":{"$ref":"#/types/distance-nonzero"},"minItems":2,"maxItems":2,"additionalItems":false},"axis":{"$ref":"#/types/direction"},"reference":{"$ref":"#/types/direction"}},"required":["primitive","origin","dimensions"]},"polycurve":{"type":"object","properties":{"primitive":{"enum":["polycurve"]},"__repr__":{"type":"string"},"attributes":{},"curves":{"type":"array","minItems":1,"items":{"oneOf":[{"$ref":"#/entities/line"},{"$ref":"#/entities/polyline"},{"$ref":"#/entities/curve"},{"$ref":"#/entities/arc"}]}}},"required":["primitive","curves"]},"polygon-set":{"$ref":"#/entities/polygonSet"},"polygonSet":{"type":"object","properties":{"primitive":{"enum":["polygonSet","polygon-set"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"polygons":{"type":"array","items":{"type":"object","properties":{"boundary":{"$ref":"#/entities/polygonSet/polygon"},"holes":{"type":"array","items":{"$ref":"#/entities/polygonSet/polygon"}}},"required":["boundary","holes"],"additionalProperties":false},"minItems":1}},"required":["primitive","polygons"],"polygon":{"type":"array","items":{"$ref":"#/types/position"},"minItems":3}},"surface":{"type":"object","properties":{"primitive":{"enum":["surface"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"uDegree":{"$ref":"#/types/index-nonzero"},"vDegree":{"$ref":"#/types/index-nonzero"},"uKnots":{"type":"array","items":{"type":"number"}},"vKnots":{"type":"array","items":{"type":"number"}},"controlPoints":{"type":"array","items":{"type":"array","items":{"$ref":"#/types/position"}}},"weights":{"type":"array","items":{"type":"number"}}},"required":["primitive","uDegree","vDegree","uKnots","vKnots","controlPoints"]},"polysurface":{"type":"object","properties":{"primitive":{"enum":["polysurface"]},"__repr__":{"type":"string"},"attributes":{},"surfaces":{"type":"array","items":{"oneOf":[{"$ref":"#/entities/polygonSet"},{"$ref":"#/entities/surface"}]},"minItems":1}},"required":["primitive","surfaces"]},"block":{"type":"object","properties":{"primitive":{"enum":["block"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"dimensions":{"$ref":"#/types/dimensions"},"axis":{"$ref":"#/types/direction"},"reference":{"$ref":"#/types/direction"}},"required":["primitive","origin","dimensions"]},"torus":{"type":"object","properties":{"primitive":{"enum":["torus"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"majorRadius":{"$ref":"#/types/coordinate"},"minorRadius":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","majorRadius","minorRadius"]},"sphere":{"type":"object","properties":{"primitive":{"enum":["sphere"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"}},"required":["primitive","origin","radius"]},"cylinder":{"type":"object","properties":{"primitive":{"enum":["cylinder"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"},"height":{"$ref":"#/types/distance-nonzero"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","radius","height"]},"cone":{"type":"object","properties":{"primitive":{"enum":["cone"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"origin":{"$ref":"#/types/position"},"radius":{"$ref":"#/types/distance-nonzero"},"height":{"$ref":"#/types/distance-nonzero"},"semiAngle":{"$ref":"#/types/angle"},"axis":{"$ref":"#/types/direction"}},"required":["primitive","origin","radius","height","semiAngle"]},"mesh":{"type":"object","properties":{"primitive":{"enum":["mesh"]},"__repr__":{"type":"string"},"attributes":{},"units":{"$ref":"#/types/units"},"vertices":{"type":"array","items":{"$ref":"#/types/position"}},"faces":{"type":"array","items":{"type":"array","items":{"$ref":"#/types/index"},"minItems":3}}},"required":["primitive","vertices","faces"]}};
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
  });

  var FluxJsonToThree = (fluxJsonToThree_common && typeof fluxJsonToThree_common === 'object' && 'default' in fluxJsonToThree_common ? fluxJsonToThree_common['default'] : fluxJsonToThree_common);

  var modelingCore = __commonjs(function (module) {
  /** @file Helper functions and classes to generate valid JSON queries to Geometry Worker server.
   *  Use {@link scene} as a starting point
   *  @author Igor Baidiuk <ibaidiuk@amcbridge.com>
   */

  /* jslint node:true */

  "use strict";

  /* Initialize this module with schema and registry objects.
   * These arguments are optional, but are required for full units-of-measure
   * support. If not provided, units will not be correctly interpreted
  */
  var _schema = {};
  var _measure = {};
  function init(schema, registry) {
      _schema.schema = schema;
      _measure.registry = registry;
  }

  var eps = 1e-8;

  // Object that containts 'genId' method, to be used for GUID generation
  // Needed for test purposes
  var gen_id_object = {};

  /* Generate uuid, that will be used as geometry id
      By default, this generates undefined. Users who want to generate id's should
      explicitly override the exported property on this module.
   */
  function guid() {
      if (isNone(gen_id_object) || isNone(gen_id_object.genId)) {
          return undefined;
      }
      return gen_id_object.genId();
  }
  // Get id from entity
  function getId(e) {
      if (e.id) {
          return e.id;
      } else if (e.__data__) {
          return e.__data__.id;
      }
      return null;
  }
  /* Converts any array-like object to actual array
     Used mostly with Arguments objects
   */

  var DEFAULT_LINEAR_TOLERANCE = 0.1;
  var DEFAULT_ANGULAR_SIZE     = 30.0;

  function toArray(obj) {
      return Array.prototype.slice.call(obj);
  }

  function notImplemented() {
      throw Error('not implemented');
  }

  function normalize(arr) {
      var m = Math.sqrt(arr[0]*arr[0] + arr[1]*arr[1]  + arr[2]*arr[2]);
      return [arr[0]/m, arr[1]/m, arr[2]/m];
  }

  function xor(l, r) { return l ? !r : r; }
  // Common dump function, returns text representation
  // check for both null and undefined
  function isNone(value) { return value === null || value === undefined; }

  function isInst(value, type) {
      if (!(type instanceof Function))
          throw Error('type: constructor expected');
      if (isNone(value))
          return false;
      return (value instanceof type) || value.constructor == type;
  }
  // Inherit one type from another, adding methods via prototype object
  function inherit(clazz, base, proto) {
      clazz.prototype = Object.create(base.prototype);
      clazz.prototype.constructor = clazz;
      if (proto)
          Object.keys(proto).forEach(
              function (key) {
                  clazz.prototype[key] = proto[key];
              }
          );
  }

  //******************************************************************************
  // Type declarations
  //******************************************************************************
  /** Use factory function {@link scene}
   *  @class
   *  @classdesc Represents block query as scene, with geometrical entities and operations over there
   */
  function Scene() {
      this.__entities__   = {};
      this.__operations__ = [];
      this.__counter__    = 1;
  }
  /** Creates new scene object
   *
   *  @return {Scene} new empty scene object
   */
  var scene = function () { return new Scene(); };
  /** Converts Scene object to JSON representation
   *  Adds custom-conversion support for {@link JSON.stringify}
   *
   *  @return {*} JSON-ready object
   */
  Scene.prototype.toJSON  = function () {
      var ops = dumpOperations(this);
      return {
          Entities:   dumpEntities(this),
          Operations: ops
      };
  };
  /* Resolves Entity or Operation object into its name in query
     Entities without a name are assigned with autogenerated name
     Operations without a name return no name and thus expanded in-place

     @param  {Entity|Operation} object - to be resolved
     @param  {number}           index  - index of current operation block, used to block forward lookups
     @return {string}                    item name, if any
   */
  function resolveItem(self, e, opIndex) {
      var key;
      if (e instanceof Entity) {
          Object.keys(self.__entities__).forEach(function (k) {
              if (!key && self.__entities__[k] === e) {
                  key = k;
              }
          });
          if (!key) {
              key = e.primitive + '@' + self.__counter__;
              self.__entities__[key] = e;
              self.__counter__ += 1;
          }
          return key;
      }
      else if (e instanceof Operation) {
          var ops = self.__operations__;
          var i;

          // find latest binding
          for (i = opIndex - 1; i >= 0; i -= 1) {
              var item = ops[i];
              if (item.operation === e) {
                  key = item.name;
                  break;
              }
          }
          // check if binding wasn't overridden later
          if (key)
              for (var j = opIndex - 1; j > i; j -= 1)
                  if (ops[j].name === key)
                      return undefined;

          return key;
      }
  }

  function dumpOperations(self) {
      var r = [];
      function makeResolver (i) {
          return function(e) { return resolveItem(self, e, i); };
      }

      for (var i = 0, e = self.__operations__.length; i < e; ++i)
          try {
              var item = self.__operations__[i];
              item._resolver = makeResolver(i);
              r.push(item.toJSON());
          }
          finally {
              if (i._resolver) i._resolver = undefined;
          }
      return r;
  }

  /*  @class
      @classdesc Named operation slot
   */
  function OpSlot(name, op) {
      this.name = name;
      this.operation = op;
  }
  OpSlot.prototype.toJSON = function () {
      var op = null;
      try {
          this.operation._resolver = this._resolver;
          op = this.operation.toJSON();
      }
      finally {
          if (this.operation._resolver) this.operation._resolver = undefined;
      }
      return {
          name: this.name,
          op:   op
      };
  };

  /** Adds entity/operation to scene
   *
   *  @param  {string}             name - name of item being added
   *  @param  {Entity|Operation}   obj  - either entity or operation being added
   *  @return {this}                      this, for chaining
   */
  Scene.prototype.add = function(name, obj) {
      if (!isInst(name, String))
          throw Error('name: string expected');
      if (isInst(obj, Entity)) {
          if (this.__entities__[name] !== undefined)
              throw Error('entity "' + name + '" already defined');
          this.__entities__[name] = obj;
      }
      else if (obj.primitive !== undefined) {
          this.__entities__[name] = entities.raw(obj);
      }
      else if (isInst(obj, Operation)) {
          this.__operations__.push(new OpSlot(name, obj));
      }
      else
          throw Error('obj: either Entity or Operation is expected');
      return this;
  };

  //******************************************************************************
  /** Use factory function {@link dcmScene}
   *  @class
   *  @classdesc Represents block query as scene, with geometrical entities, constraints, variables, equations and operations over there
   */
  function DCMScene() {
      this.__entities__   = {};
      this.__constraints__ = {};
      this.__variables__ = {};
      this.__equations__ = {};
      this.__operations__ = [];
  }

  // Adds array of elements to scene
  DCMScene.prototype.addMultiple = function (elements) {
      var self = this;
      Object.keys(elements).forEach(function(key){
          self.add(elements[key], key);
      });
  };

  /** Creates new scene object
   *  @param  {Object} value - optional, object with entities, constraints, etc.., to initialize scene
   *
   *  @return {DCMScene} new scene object
   */
  var dcmScene = function (value) {
      var scene = new DCMScene();
      if (value) {
          Object.keys(value).forEach(function(key) {
              if (value[key])
                  scene.addMultiple(value[key]);
          });
      }

      return scene;
  };
  /** Converts DCMScene object to JSON representation
   *  Adds custom-conversion support for {@link JSON.stringify}
   *
   *  @return {*} JSON-ready object
   */
  DCMScene.prototype.toJSON  = function () {
      var ops = dumpDCMOperations(this);
      var equats = dumpEquations(this);
      var vars = dumpVariables(this);
      var cons = dumpConstraints(this);
      return {
          Entities:       dumpEntities(this),
          Constraints:    cons,
          Variables:      vars,
          Equations:      equats,
          Operations:     ops
      };
  };

  /* Resolves Entity, Constraint, Variable, Equation or Operation object into its name in query
     Entities, Constraints, Variables and Equations without a name are assigned with guid
     Operations without a name return no name and thus expanded in-place

     @param  {Entity|Constraint|Variable|Equation|Operation}  object to be resolved
     @param  {number}                                         index of current operation block, used to block forward lookups
     @return {string}                                         item name, if any
   */
  function resolveDCMItem(self, e, opIndex) {
      var key;
      if (e instanceof Entity) {
          Object.keys(self.__entities__).forEach(function (k) {
              if (!key && self.__entities__[k] === e) {
                  key = k;
              }
          });
          if (!key) {
              key = getId(e) || guid();
              self.__entities__[key] = e;
          }
      }
      else if (e instanceof Operation) {
          var ops = self.__operations__;
          var i;

          // find latest binding
          for (i = opIndex - 1; i >= 0; i -= 1) {
              var item = ops[i];
              if (item.operation === e) {
                  key = item.name;
                  break;
              }
          }
          // check if binding wasn't overridden later
          if (key)
              for (var j = opIndex - 1; j > i; j -= 1)
                  if (ops[j].name === key)
                      return undefined;
      }
      return key;
  }

  /*  Internal function, converts given objects to JSON
   */
  function dumpElements(self, elements) {
      var r = {};
      var es = elements;
      Object.keys(elements).forEach(
          function (k) {
              r[k] = es[k].toJSON();
          }
      );

      return r;
  }

  /*  Internal function, converts entity objects to JSON
   */
  function dumpEntities(self) {
      return dumpElements(self, self.__entities__);
  }

  /*  Internal function, converts constraint objects to JSON
   */
  function dumpConstraints(self) {
      return dumpElements(self, self.__constraints__);
  }

  /*  Internal function, converts variable objects to JSON
   */
  function dumpVariables(self) {
      return dumpElements(self, self.__variables__);
  }

  /*  Internal function, converts variable objects to JSON
   */
  function dumpEquations(self) {
      return dumpElements(self, self.__equations__);
  }

  function dumpDCMOperations(self) {
      var r = [];
      function makeResolver (i) {
          return function(e) { return resolveDCMItem(self, e, i); };
      }

      for (var i = 0, e = self.__operations__.length; i < e; ++i)
          try {
              var item = self.__operations__[i];
              item._resolver = makeResolver(i);
              r.push(item.toJSON());
          }
          finally {
              if (i._resolver) i._resolver = undefined;
          }
      return r;
  }

  DCMScene.prototype.hasEntity = function (name) {
      return this.__entities__[name] !== undefined;
  };

  DCMScene.prototype.hasConstraint = function (name) {
      return this.__constraints__[name] !== undefined;
  };

  DCMScene.prototype.hasVariable = function (name) {
      return this.__variables__[name] !== undefined;
  };

  DCMScene.prototype.hasEquation = function (name) {
      return this.__equations__[name] !== undefined;
  };

  // Helper function. Switches all ids in entity fields to new guids
  function updateEntityIds (elem) {
      if (elem && elem.__data__) {
          var data = elem.__data__;
          var idFields = ['startId', 'endId', 'originId'];
          idFields.forEach(function(field){
              if (data.hasOwnProperty(field)) {
                  data[field] = guid();
              }
          });

          // 'id' field is obligatory
          data.id = guid();
      }

      return elem;
  }

  DCMScene.prototype.updateEntity = function (old) {
      var name = getId(old);
      var self = this;
      if (!self.hasEntity(name))
          throw Error("Entity " + name + " is not present in scene");
      var e = self.__entities__[name];
      updateEntityIds(e);
      return e;
  };

  // Generates entities related to given one (e.g. end points
  // of the line), adds them and entity itself to scene
  DCMScene.prototype.addEntity = function(entity, name) {
      var self = this;
      var data = entity.__data__;
      switch (data.primitive)
      {
          case 'point':
          case 'curve':
          {
              // Entity is self-sufficient, so need to add only entity itself
              break;
          }
          case 'line':
          {
              if (!self.hasEntity(data.startId)) {
                  self.addEntity(entities.point(data.start, data.startId), data.startId);
              }
              if (!self.hasEntity(data.endId)) {
                  self.addEntity(entities.point(data.end, data.endId), data.endId);
              }
              break;
          }
          case 'circle':
          case 'ellipse':
          {
              if (!self.hasEntity(data.originId)) {
                  self.addEntity(entities.point(data.origin, data.originId), data.originId);
              }
              break;
          }
          case 'arc':
          {
              if (!self.hasEntity(data.originId)) {
                  var origin = getCircleCenterByThreePoints(data.start, data.middle, data.end);
                  self.addEntity(entities.point(origin, data.originId), data.originId);
              }
              if (!self.hasEntity(data.startId)) {
                  self.addEntity(entities.point(data.start, data.startId), data.startId);
              }
              if (!self.hasEntity(data.endId)) {
                  self.addEntity(entities.point(data.end, data.endId), data.endId);
              }
              break;
          }
          case 'polyline':
          {
              notImplemented(); // TODO Need to know which blocks will be given as inputs
              break;
          }
          case 'polycurve':
          {
              notImplemented(); // TODO Implement after polyline
              break;
          }
          default:
          {
              throw Error("Entity with primitive " + entity.primitive + " can not be added to scene");
          }
      }

      self.__entities__[name] = entity;
  };
  /** Adds entity/constraint/variable/equation/operation to scene
   *
   *  @param          obj  - either entity, constraint, variable, equation or operation being added
   *  @param {string} name - name of item being added
   *  @return              - this object, for chain of calls
   */
  DCMScene.prototype.add = function(obj, name) {
      name = name || getId(obj);
      if (!isInst(name, String))
          throw Error('name: string expected ' + name + '   ' + JSON.stringify(obj));
      if (isInst(obj, Entity)) {
          if (!this.hasEntity(name))
              this.addEntity(obj, name);
      }
      else if (isInst(obj, Constraint)) {
          if (this.hasConstraint(name))
              throw Error('constraint "' + name + '" already defined');
          this.__constraints__[name] = obj;
      }
      else if (isInst(obj, Variable)) {
          if (this.hasVariable(name))
              throw Error('variable "' + name + '" already defined');
          this.__variables__[name] = obj;
      }
      else if (isInst(obj, Equation)) {
          if (this.hasEquation(name))
              throw Error('equation "' + name + '" already defined');
          this.__equations__[name] = obj;
      }
      else if (obj.primitive !== undefined) {
          if (!this.hasEntity(name))
              this.addEntity(entities.raw(obj), name);
      }
      else if (obj.type !== undefined) {
          if (this.hasConstraint(name))
              throw Error('constraint "' + name + '" already defined');
          this.__constraints__[name] = constraints.raw(obj);
      }
      else if (obj.name !== undefined && obj.value !== undefined) {
          throw Error('Adding raw variable is not supported');
      }
      else if (obj.equation !== undefined) {
          throw Error('Adding raw equation is not supported');
      }
      else if (isInst(obj, Operation)) {
          this.__operations__.push(new OpSlot(name, obj));
      }
      else
          throw Error('obj: either Entity, Constraint, Variable, Equation or Operation is expected');
      return this;
  };

  //******************************************************************************
  /** Use functions from {@link entities} to construct
   *  @class
   *  @classdesc Represents entity in Flux protocol. These objects are added to the 'Entities' part of scene
   */
  function Entity(id) { this.primitive = id; }
  /** JSON representation of entity
   *  Adds support for {@link JSON.stringify}
   *
   *  @return {*} JSON object
   */
  Entity.prototype.toJSON    = function() { return this.__data__; };

  /** Add attribute to entity
   *  If first argument is a string, it's treated as attribute type,
   *  and second argument is treated as attribute value.
   *  Otherwise, first argument is treated as full attribute object.
   *  Its type key is retrieved via type() method,
   *  and the whole object is used as attribute value.
   *  See {@link attributes} for known attribute types
   *
   *  @param  {*|string} objkey  - either attribute key (string) or full attribute object (*)
   *  @param  {*}        [value] - raw attribute value
   *  @return {this}               this, for chaining
   */
  Entity.prototype.attribute = function(keyobj, value) {
      var d = this.__data__;
      var key;
      if (typeof(keyobj) === "string")
          key = keyobj;
      else
      {
          key = keyobj.type();
          value = keyobj;
      }

      if (!d.attributes)
          d.attributes = {};
      if (d.attributes[key])
          throw Error("attribute of type '" + key + "' already defined");
      d.attributes[key] = value;
      return this;
  };
  //******************************************************************************/
  // Pseudo-classes representing entity categories

  /**
   *  @class
   *  @extends Entity
   *  @classdesc Represents any limited embodied geometry
   */
  function Body() { Entity.apply(this, arguments); }
  // Inherit Body from Entity
  inherit(Body, Entity,
  /** @lends Body.prototype */
  {
      /** Adds axis vector to the body
      *   @param {number[]|Vector} a - axis vector
      *   @return {this}               this, for chaining
      */
      axis: function (a) {
          this.__data__.axis = vecCoords(a);
          return this;
      },
      /** Adds reference vector to the body
      *   @param {number[]|Vector} ref - reference vector
      *   @return {this}                 this, for chaining
      */
      reference: function (ref) {
          this.__data__.reference = vecCoords(ref);
          return this;
      }
  });
  /**
   *  @class
   *  @extends Body
   *  @classdesc Represents 3D point
   */
  function Point() { Body.apply(this, arguments); }
  inherit(Point, Body);
  /**
   *  @class
   *  @extends Body
   *  @classdesc Wire entities, i.e. polylines, curves, ellipses
   */
  function Wire() { Body.apply(this, arguments); }
  inherit(Wire, Body);
  /**
   *  @class
   *  @extends Body
   *  @classdesc Sheet entities, i.e. polygon sets, surfaces
   */
  function Sheet() { Body.apply(this, arguments); }
  inherit(Sheet, Body);
  /**
   *  @class
   *  @extends Body
   *  @classdesc Solid entities, i.e. meshes, spheres, boxes
   */
  function Solid() { Body.apply(this, arguments); }
  inherit(Solid, Body);
  /**
   *  @class
   *  @extends Body
   *  @classdesc General bodies; can be received only as a result of some operation
   */
  function General() { Body.apply(this, arguments); }
  inherit(General, Body);

  /**
   *  @class
   *  @extends Entity
   *  @classdesc Analytical geometry entities
   */
  function Geometry() { Entity.apply(this, arguments); }
  inherit(Geometry, Entity);
  /**
   *  @class
   *  @extends Geometry
   *  @classdesc Infinite plane
   */
  function Plane() { Geometry.apply(this, arguments); }
  inherit(Plane, Geometry);
  /**
   *  @class
   *  @extends Geometry
   *  @classdesc 3D direction vector
   */
  function Vector() { Geometry.apply(this, arguments); }
  inherit(Vector, Geometry);


  function parsePath(s) {
      if(s[0] !== "#") {
          throw "Expected paths similar to #/foo/bar/baz";
      }
      s = s.substr(2);
      return s.split("/");
  }

  function getSubSchema(refPath) {
      var components = parsePath(refPath);
      var s = _schema.schema;
      for (var i = 0; i < components.length; i++) {
          var sub = s[components[i]];
          s = sub;
      }
      return s;
  }

  function recurseToDimension(subSchema) {
      if (subSchema === undefined) {
          return undefined;
      }
      if (subSchema.$ref !== undefined) {
          return recurseToDimension(getSubSchema(subSchema.$ref));
      }
      if (subSchema.oneOf !== undefined) {
          return recurseToDimension(subSchema.oneOf[0]);
      }
      switch(subSchema.type) {
          // As our units-of-measurement schema does not index into arrays,
          // assume that all items in each array have the same dimension.
          case "array":
              return recurseToDimension(subSchema.items);
          case "number":
              return subSchema.fluxDimension;
          // We swallow any sub-objects that might ahve further
          // case "object":
      }
      return undefined;
  }

  /** Looks up field to dimension mapping for entity types.
   * This is a very limited implementation that only supports units scoped a
   * single-field deep, and does not support indexing into composite entities
   * (eg, polycurve and polysurface). It does work for the existing set of
   * entities as described in psworker.json, but extensions to that may require
   * revisiting this implementation.
   *
   *  @param  {string}    typeid  - name of entity type, value for 'primitive' property
   *  @return {object}            - map from field to dimension
   */
  function lookupFieldDimensions(typeid) {
      var subSchema = _schema.schema.entities[typeid];

      var results = {};
      for (var key in subSchema.properties) {
          var d = recurseToDimension(subSchema.properties[key]);
          if (d !== undefined) {
              results[key] = d;
          }
      }
      return results;
  }


  // TODO(andrew): consdier setting these at a per-project level, rather than
  // hardcoding them.
  var _defaultDimToUnits = {
      "length":"meters",
      "area":"meters*meters",
      "volume":"meters*meters*meters",
      "angle":"degrees"
  };


  /** Looks up default field units
   *
   *  @param  {string}    typeid  - name of entity type, value for 'primitive' property
   *  @return {object}            - map from field to unit, appropriate for setting
   *                                as the "units" field of an entity.
   */
  function defaultUnits(typeid) {
      var dimensions = lookupFieldDimensions(typeid);
      var results;
      for (var key in dimensions) {
          if (results === undefined) {
              results = {};
          }
          results[key] = _defaultDimToUnits[dimensions[key]];
      }
      return results;
  }

  /** Determines whether or not an entity has units information attached
   *
   *  @param  {object}    entity  - name of entity type, value for 'primitive' property
   *  @return {object}            - map from field to unit, appropriate for setting
   *                                as the "units" field of an entity.
   */
  function detectUnits(entity) {
      // TODO(andrew): get rid of __data
      if (entity instanceof Entity) {
          entity = entity.toJSON();
      }

      // If units are defined, return true
      if (entity.units) {
          return true;
      }

      // Brep entities have implicit units.
      if (entity.primitive == "brep") {
          return true;
      }

      // For polycurve and polysurface entities, loop through subentities;
      if (entity.primitive == "polycurve") {
          for (var i = 0; i < entity.curves.length; i++) {
              if (detectUnits(entity.curves[i])) {
                  return true;
              }
          }
      }
      if (entity.primitive == "polysurface") {
          for (var j = 0; j < entity.surfaces.length; j++) {
              if (detectUnits(entity.surfaces[j])) {
                  return true;
              }
          }
      }

      return false;
  }


  /** Helper function

      @private
      @param  {string}   typeid  - name of entity type, value for 'primitive' property
      @param  {any}      params  - additional parameters of entity
      @param  {function} OptCtor - optional, constructor function; {@link Entity} if undefined
      @return {Entity}             Entity or any other type specified by OptCtor
  */
  function primitive(typeid, params, OptCtor) {
      OptCtor = OptCtor || Entity;
      var e = new OptCtor(typeid);
      e.__data__ = params;
      e.__data__.primitive = typeid;
      e.__data__.units = defaultUnits(typeid);
      return e;
  }
  /** Helper function to extract point coordinates

      @private
      @param  {any}   obj  - entity or array
      @param  {string} dimToUnits - optional, desired units of resulting
          vector. Only used if the input object is an entity, and if this module
          has been init'd with a units of measure registry.
      @return {Array}             Coordinate array
  */
  function coords(obj, dimToUnits) {
      if (Array.isArray(obj))
          return obj;

      // TODO(andrew): get rid of the __data subobject.
      if (obj instanceof Point) {
          obj = obj.toJSON();
      }

      if (obj.primitive == "point") {
          if (dimToUnits === undefined) {
              dimToUnits = _defaultDimToUnits;
          }

          // Only perform the conversion if we have a registry, and if the units
          // do not already match the desired units.
          if (_measure.registry !== undefined &&
              obj.units && obj.units.point != dimToUnits.length) {
              obj = _measure.registry.ConvertUnits(obj,dimToUnits);
          }
          return obj.point;
      }
      throw Error("expected array of numbers or Point entity");
  }

  function mapCoords(vec) {
      var out = [];
      for (var i = 0, e = vec.length; i < e; ++i)
          out.push(coords(vec[i]));
      return out;
  }

  /** Helper function to extract vector components

      @private
      @param  {any}   obj  - entity or array
      @param  {string} dimToUnits - optional, desired units of resulting
          vector. Only used if the input object is an entity, and if this module
          has been init'd with a units of measure registry.
      @return {Array}             Component array
  */
  function vecCoords(obj, dimToUnits) {
      if (Array.isArray(obj))
          return obj;

      if (obj instanceof Vector) {
          obj = obj.toJSON();
      }

      if (obj.primitive == "vector") {
          if (dimToUnits === undefined) {
              dimToUnits = _defaultDimToUnits;
          }

          // Only perform the conversion if we have a registry, and if the units
          // do not already match the desired units.
          if (_measure.registry !== undefined &&
              obj.units && obj.units.coords != dimToUnits.length) {
              obj = _measure.registry.ConvertUnits(obj,dimToUnits);
          }
          return obj.coords;
      }
      throw Error("expected array of numbers or Vector entity");
  }

  function mapVecCoords(vec) {
      var out = [];
      for (var i = 0, e = vec.length; i < e; ++i)
          out.push(vecCoords(vec[i]));
      return out;
  }

  // Multiply 2 matrices
  function multMatrix(a, b) {
      var len = a.length;

      var c = new Array(len);
      var i;

      var dim = Math.sqrt(len);

      for (i = 0; i < dim; ++i)
          for (var j = 0; j < dim; ++j) {
              var s = 0;
              for (var k = 0 ; k < dim; ++k)
                  s += a[i * dim + k] * b[k * dim + j];
              c[i * dim + j] = s;
          }
      return c;
  }
  // Applies additional affine transform by pre-multiplying
  function applyMatrix(self, m) {
      self.__data__.mat = multMatrix(m, self.__data__.mat);
      return self;
  }

  /** Use {@link entities.affine} to construct
   *  @class
   *  @extends Entity
   *  @classdesc Entity which represents affine transformation matrix
   */
  function Affine() { Entity.apply(this, arguments); }
  // Inherit Affine from Entity
  inherit(Affine, Entity,
  /** @lends Affine.prototype */
  {
      /** Adds 3D translation
       *  @param  {number[]|Vector} delta - translation vector
       *  @return {this}                    this, for chaining
       */
      translate: function (d) {
          d = vecCoords(d);
          return applyMatrix(this, [
               1,  0,  0, d[0],
               0,  1,  0, d[1],
               0,  0,  1, d[2],
               0,  0,  0,  1
          ]);
      },
      /** Adds 3D rotation around X axis
       *  @param  {number} phi - rotation angle, in degrees
       *  @return {this}         this, for chaining
       */
      rotateX: function (phi) {
          phi = phi * Math.PI / 180;
          var sin = Math.sin(phi), cos = Math.cos(phi);
          return applyMatrix(this, [
               1,    0,    0, 0,
               0,  cos,  sin, 0,
               0, -sin,  cos, 0,
               0,    0,    0, 1
          ]);
      },
      /** Adds 3D rotation around Y axis
       *  @param  {number} phi - rotation angle, in degrees
       *  @return {this}         this, for chaining
       */
      rotateY: function (phi) {
          phi = phi * Math.PI / 180;
          var sin = Math.sin(phi), cos = Math.cos(phi);
          return applyMatrix(this, [
                cos, 0, -sin, 0,
                  0, 1,    0, 0,
                sin, 0,  cos, 0,
                  0, 0,    0, 1
          ]);
      },
      /** Adds 3D rotation around Z axis
       *  @param  {number} phi - rotation angle, in degrees
       *  @return {this}         this, for chaining
       */
      rotateZ: function (phi) {
          phi = phi * Math.PI / 180;
          var sin = Math.sin(phi), cos = Math.cos(phi);
          return applyMatrix(this, [
                cos,  sin, 0, 0,
               -sin,  cos, 0, 0,
                  0,    0, 1, 0,
                  0,    0, 0, 1
          ]);
      },
      /** Adds 3D scaling
       *  @param  {number[]|Vector} scale - scaling vector
       *  @return {this}                    this, for chaining
       */
      scale: function(s) {
          s = vecCoords(s);
          return applyMatrix(this, [
               s[0],  0,   0,  0,
                 0, s[1],  0,  0,
                 0,   0, s[2], 0,
                 0,   0,   0,  1
          ]);
      },
      /** Rotate around arbitrary vector
       *  @param  {number[]|Vector} axis - rotation axis
       *  @param  {number}          phi  - rotation angle, in degrees
       *  @return {this}                   this, for chaining
       */
      rotateAboutAxis: function (a, phi) {
          phi = phi * Math.PI / 180;
          var sin = Math.sin(phi), cos = Math.cos(phi);
          a = vecCoords(a);
          a = normalize(a);
          var x = a[0], y = a[1], z = a[2];
          return applyMatrix(this, [
              cos+x*x*(1-cos),    x*y*(1-cos)-z*sin, y*sin+x*z*(1-cos),  0,
              z*sin+x*y*(1-cos),  cos+y*y*(1-cos),   -x*sin+y*z*(1-cos), 0,
              -y*sin+x*z*(1-cos), x*sin+y*z*(1-cos), cos+z*z*(1-cos),    0,
              0,                  0,                 0,                  1
          ]);
      },
      /** Reflect against specified plane
       *  @param  {number[]|Point} normal - plane's normal vector
       *  @param  {number[]|Point} origin - in-plane point
       *  @return {this}        this, for chaining
       */
      reflection: function (n, p) {
          n = vecCoords(n);
          p = coords(p);
          var nx = n[0], ny = n[1], nz = n[2],
              px = p[0], py = p[1], pz = p[2];

          var len = Math.sqrt(nx*nx + ny*ny + nz*nz);
          nx /= len; ny /= len; nz /= len;

          var d = -nx * px - ny * py - nz * pz;

          return applyMatrix(this, [
              1.0 - 2 * nx * nx,  -2 * nx * ny,       -2 * nx * nz,       -2 * nx * d,
              -2 * nx * ny,       1.0 - 2 * ny * ny,  -2 * ny * nz,       -2 * ny * d,
              -2 * nx * nz,       -2 * ny * nz,       1.0 - 2 * nz * nz,  -2 * nz * d,
              0,                  0,                  0,                  1
          ]);
      },

      /** Compose with another transformation
       *  @param {affine} t - transformation to compose with.
       */
       compose: function (t) {
          return applyMatrix(this, t.mat || t.__data__.mat);
       }
  });

  /** Use {@link entities.polygonSet} to construct
   *  @class
   *  @extends Sheet
   *  @classdesc Entity which represents set of polygons
   */
  function PolygonSet() { Sheet.apply(this, arguments); }
  // inherit PolygonSet from Entity
  inherit(PolygonSet, Sheet,
  /** @lends PolygonSet.prototype */
  {
      /** Adds new outer boundary loop polygon to set
       *
       *  @function
       *  @param  {...(number[]|Point)} points - a set of points representing polygon
       *  @return {this}                 this, for chaining
       */
      boundary: function () { // add polygon to set
          var polys = this.__data__.polygons;

          polys.push({
              boundary: mapCoords(arguments),
              holes: []
          });
          return this;
      },
      /** Adds inner hole loop to the last polygon in a set
       *
       *  @function
       *  @param  {...(number[]|Point)} points - a set of points representing hole
       *  @return {this}                 this, for chaining
       */
      hole: function() { // add hole to last polygon
          var polys = this.__data__.polygons;
          var last = polys[polys.length - 1];
          last.holes.push(mapCoords(arguments));
          return this;
      }
  });
  /** Use {@link entities.mesh} to construct
   *  @class
   *  @extends Solid
   *  @classdesc Entity which represents 3D polygonal mesh
   */
  function Mesh() { Solid.apply(this, arguments); }
  // inherit Mesh from Entity
  inherit(Mesh, Solid,
  /** @lends Mesh.prototype */
  {
      /** Adds vertex to mesh
       *
       *  @function
       *  @param  {number[]|Point} coords
       *  @return {this}           this, for chaining
       */
      vertex: function (c) {
          this.__data__.vertices.push(coords(c));
          return this;
      },
      /** Builds new face in mesh from vertex indices
       *
       *  @function
       *  @param  {...number} index - indices of vertices constituting face
       *  @return {this}              this, for chaining
       */
      face: function() {
          this.__data__.faces.push(toArray(arguments));
          return this;
      }
  });

  function appendToField(field) {
      return function() {
          var self = this;
          toArray(arguments).forEach(function (i) {
              self.__data__[field].push(i);
          });
          return this;
      };
  }
  // Transforms incoming data item to 'canonical' weighted vertex form
  // Canonical form is a 2-element array, with first element being 3-element array with point coordinates
  // and second being either weight noumber or 'undefined'
  //
  // Supported forms are:
  // 1. 3-number array  - unweighted
  // 2. 4-number array  - weighted
  // 3. Point           - unweighted
  // 4. [Point]         - unweighted
  // 5. [Point, number] - weighted
  // 6. Point.toJSON()  - unweighted
  function canonicVertex(item) {
      if (Array.isArray(item)) {       // one of array cases
          if (item.length == 1)
              // repr #4 - unpack single array element and try to treat it as item
              return canonicVertex(item[0]);
          if (item.length == 2)
              // repr #5
              return [coords(item[0]), item[1]];
          if (item.length == 3)
              // repr #1
              return [item, undefined];
          if (item.length == 4)
              // repr #2
              return [item.slice(0, 3), item[3]];
      }
      else if (item instanceof Point || item.primitive == "point") // Point case
          // repr #3, #6
          return [coords(item), undefined];
      // Didn't match anything, so just throw
      throw Error("Unsupported vertex representation");
  }

  function appendVertex(ctxt, item) {
      item = canonicVertex(item);
      var pt = item[0], w = item[1];

      if (ctxt.weights === undefined) {
          if (w !== undefined) {
              if (ctxt.points.length === 0)
                  ctxt.weights = [ w ];
              else
                  throw Error('Cannot add weighted vertex because previous vertices were weightless');
          }
          ctxt.points.push(pt);
      }
      else {
          if (w === undefined)
              throw Error('Vertex must have weight specified');
          ctxt.weights.push(w);
          ctxt.points.push(pt);
      }
      // NB: case where points are empty, and weights are not, isn't an error - because weights are in a linear array, and points aren't always
  }

  /** Use {@link entities.curve} to construct
   *  @class
   *  @extends Wire
   *  @classdesc Entity which represents NURBS curve
   */
  function Curve() { Wire.apply(this, arguments); }
  // inherit Curve from Wire
  inherit(Curve, Wire,
  /** @lends Curve.prototype */
  {
      /** Appends numbers to array of knots
       *
       *  @function
       *  @param  {...number} knot - knot values
       *  @return {this}             this, for chaining
       */
      knots:  appendToField('knots'),
      /** Adds curve vertex, either weighted or weightless
       *
       *  Weightless vertices are specified in one of the following formats:
       *  - 3 numbers
       *  - 1 Point
       *  - array of 3 numbers
       *  Weighted vertices are specified in one of the following formats:
       *  - 4 numbers
       *  - 1 Point, 1 number
       *  - array of 3 numbers, 1 number
       *  Also, any of these sets of arguments can be passed as a single argument, packed into array
       *  @function
       *  @return {this}                      this, for chaining
       */
      vertex: function () {
          var c    = this.__data__;
          var ctxt = { points: c.controlPoints, weights: c.weights };
          appendVertex(ctxt, toArray(arguments));
          c.controlPoints = ctxt.points;
          c.weights       = ctxt.weights;
          return this;
      }
  });

  /** Use {@link entities.surface} to construct
   *  @class
   *  @extends Sheet
   *  @classdesc Entity which represents NURBS surface
   */
  function Surface() { Sheet.apply(this, arguments); }
  // inherit Surface from Sheet
  inherit(Surface, Sheet,
  /** @lends Surface.prototype */
  {
      /** Appends numbers to array of U-axis knots
       *
       *  @function
       *  @param  {...number} knot - knot values
       *  @return {this}             this, for chaining
       */
      uKnots: appendToField('uKnots'),
      /** Appends numbers to array of V-axis knots
       *
       *  @function
       *  @param  {...number} knot - knot values
       *  @return {this}             this, for chaining
       */
      vKnots: appendToField('vKnots'),
      /** Appends separate row (along surface's U axis) of control points to surface
       *
       *  @function
       *  @param  {...any} point - control points; for supported point representations, see {@link Curve#vertex}, except each vertex is passed as a single argument
       *  @return {this}           this, for chaining
       */
      row: function() {
          var c    = this.__data__;
          var ctxt = { points: [], weights: c.weights };

          for (var i = 0, e = arguments.length; i < e; ++i)
              appendVertex(ctxt, toArray(arguments[i]));

          c.controlPoints.push(ctxt.points);
          c.weights = ctxt.weights;
          return this;
      },
      /** Appends multiple rows of control points to surface
       *
       *  @function
       *  @param  {...any[]} row - rows of control points; see {@link Surface#row} for exact row structure
       *  @return {this}           this, for chaining
       */
      points: function() {
          for (var i = 0, e = arguments.length; i < e; ++i)
              this.row.apply(this, arguments[i]);
          return this;
      }
  });

  //******************************************************************************
  /** Use functions from {@link constraints} to construct
   *  @class
   *  @classdesc Represents constraint in Flux protocol. These objects are added to the 'Constraints' part of scene
   */
  function Constraint(id) { this.type = id; }

  /** JSON representation of constraint
   *  Adds support for {@link JSON.stringify}
   *
   *  @return {*} JSON object
   */
  Constraint.prototype.toJSON = function () {
      return this.__data__;
  };

  /** Helper function

      @private
      @param  {string}   typeid  - name of constraint type, value for 'type' property
      @param  {any}      params  - additional parameters of constraint
      @return {Constraint}         Constraint
  */
  function type(typeid, params) {
      var e = new Constraint(typeid);
      e.__data__ = params;
      e.__data__.type = typeid;
      e.__data__.id = guid();
      return e;
  }

  //******************************************************************************
  /** Use functions from {@link variables} to construct
   *  @class
   *  @classdesc Represents variable in Flux protocol. These objects are added to the 'Variables' part of scene
   */
  function Variable() {}

  /** Helper function

      @private
      @param  {any}      params - parameters of variable
      @return {Variable}          Variable
  */
  function variable(params) {
      var v = new Variable();
      v.__data__ = params;
      v.__data__.id = guid();
      return v;
  }

  /** JSON representation of variable
   *  Adds support for {@link JSON.stringify}
   *
   *  @return {*} JSON object
   */
  Variable.prototype.toJSON = function () {
      return this.__data__;
  };

  //******************************************************************************
  /** Use functions from {@link equations} to construct
   *  @class
   *  @classdesc Represents equation in Flux protocol. These objects are added to the 'Equations' part of scene
   */
  function Equation() {}

  /** Helper function

      @private
      @param  {any}      params - parameters of equation
      @return {Equation}          Equation
  */
  function equation(params) {
      var e = new Equation();
      e.__data__ = params;
      e.__data__.id = guid();
      return e;
  }

  /** JSON representation of equation
   *  Adds support for {@link JSON.stringify}
   *
   *  @return {*} JSON object
   */
  Equation.prototype.toJSON = function () {
      return this.__data__;
  };

  //******************************************************************************
  /** Use functions from {@link operations} to construct
   *  @class
   *  @classdesc Encapsulates info about operation in DCM/Parasolid Worker protocol
   */
  function Operation(id) {
      this.opcode = id;
  }
  /** Converts operation body to JSON
      Adds support for {@link JSON.stringify}

      @return {*} JSON-ready object
   */
  Operation.prototype.toJSON = function () {
      var r = [this.opcode];
      var self = this;
      if (this.args) {
          this.args.forEach(function (v) {
              if (v instanceof Operation) {
                  try {
                      var name = self._resolver(v); // check if that operation was already bound
                      if (name) {
                          r.push(name);
                      }
                      else {
                          v._resolver = self._resolver;
                          r.push(v.toJSON());
                      }
                  }
                  finally {
                      if (v._resolver) v._resolver = undefined;
                  }
              }
              else if (v instanceof Entity) { // locate bound entity by name
                  if (!self._resolver)
                      throw Error("No entity resolver provided");
                  r.push(self._resolver(v));
              }
              else if (v.primitive !== undefined) {
                  var eraw = entities.raw(v);
                  if (!self._resolver)
                      throw Error("No entity resolver provided");
                  r.push(self._resolver(eraw));
              }
              else {
                  r.push(v);
              }
          });
      }
      return r;
  };
  // Helper, generates operation factory
  function op(id, nargs) {
      return function() {
          var r = new Operation(id);
          r.args = toArray(arguments).slice(0, nargs);
          return r;
      };
  }
  //******************************************************************************
  // Attributes
  //******************************************************************************

  /** Use {@link attributes.material} to construct
   *  @class
   *  @classdesc Material attribute
   */
  function Material() { this.__data__ = { }; }
  /** @lends Material.prototype */
  Material.prototype = {
      constructor: Material,
      /** Returns "material" for attribute type name
       *  @return {string} "material"
       */
      type: function() { return "material"; },
      /** Converts material to JSON object. Adds support for {@link JSON.stringify}
       *  @return {*} JSON-ready object
       */
      toJSON: function() { return this.__data__; },
      /** Sets ambient, diffuse and specular color values
       *
       *  @function
       *  @param  {number} - red
       *  @param  {number} - green
       *  @param  {number} - blue
       *  @return {this}     this, for chaining
       */
      color: function (r, g, b) {
          return this.ambient(r, g, b).diffuse(r, g, b).specular(r, g, b).power(1);
      },
      /** Sets ambient color
       *
       *  @function
       *  @param  {number} - red
       *  @param  {number} - green
       *  @param  {number} - blue
       *  @return {this}     this, for chaining
       */
      ambient: function (r, g, b) {
          this.__data__.ambient = [r, g, b];
          return this;
      },
      /** Sets specular color
       *
       *  @function
       *  @param  {number} - red
       *  @param  {number} - green
       *  @param  {number} - blue
       *  @return {this}     this, for chaining
       */
      specular: function (r, g, b) {
          this.__data__.specular = [r, g, b];
          return this;
      },
      /** Sets diffuse color
       *
       *  @function
       *  @param  {number} - red
       *  @param  {number} - green
       *  @param  {number} - blue
       *  @return {this}     this, for chaining
       */
      diffuse: function (r, g, b) {
          this.__data__.diffuse = [r, g, b];
          return this;
      },
      /** Sets specular power
       *
       *  @function
       *  @param  {number} power
       *  @return {this}   this, for chaining
       */
      power: function (s) {
          this.__data__.power = s;
          return this;
      }
  };

  var attributes =
  /** Attribute constructors.
   *  Attributes are added to entities via {@link Entity#attribute Entity.attribute}
   *  @namespace attributes
   */
  {
      /** Constructs material attribute
       *  @function
       *  @return {Material}
       */
      material: function () { return new Material(); }
  };

  /** Sets entity attribute on either a list of entities, raw object or instance of entity.
   *
   *  @function
   *  @param  {entity} entity - entity to modify
   *  @param  {string} property   - property
    *  @param  {*} value   - value
   *  @return {*}                 - entity with attribute set
   */
  var setEntityAttribute = function(entity, property, value) {
      if (Array.isArray(entity)) {
          return entity.map(function(elt) {
              setEntityAttribute(elt, property, value);
          });
      }
      if (!(entity instanceof Entity)) {
          // Rehydrate entity. This moves fields to the __data__ field, and attaches
          // entity methods.
          var ent = entities.raw(entity);
          ent.attribute(property, value);
          return ent.toJSON();
      } else {
          return entity.attribute(property, value);
      }
  };

  /** Gets entity attribute on either raw object or instance of entity.
   *
   *  @function
   *  @param  {Entity} entity - entity to query
   *  @param  {string} property   - property
   *  @return {*}                 - attribute value
   */
  var getEntityAttribute = function(entity, property) {
      if (Array.isArray(entity)) {
          return entity.map(function(elt) {
              getEntityAttribute(elt, property);
          });
      }
      if (!(entity instanceof Entity)) {
          // Rehydrate entity. This moves fields to the __data__ field, and attaches
          // entity methods.
          return entity.attributes[property];
      } else {
          return entity.__data__.attributes[property];
      }
  };


  //******************************************************************************
  // Utilities
  //******************************************************************************
  var utilities = {
      coords:coords,
      vecCoords:vecCoords,
      setEntityAttribute: setEntityAttribute,
      getEntityAttribute: getEntityAttribute,
      defaultUnits: defaultUnits,
      detectUnits: detectUnits,
      lookupFieldDimensions: lookupFieldDimensions
  };

  //******************************************************************************
  // Entities
  //******************************************************************************
  // var entities is used for self-call
  var entities =
  /** Entity constructors
   *  @namespace entities
   */
  {
      //******************************************************************************
      // Raw entity, specified directly as JSON
      //******************************************************************************
      /** Constructs entity object from raw data. No checks for primitive value, body being object etc.
       *
       *  @param  {*}      body - any JavaScript value
       *  @return {Entity}
       */
      raw: function(body) {
          var e = new Entity(body.primitive);
          e.__data__ = body;
          return e;
      },

      //******************************************************************************
      // Vector entity
      //******************************************************************************

      /** Constructs Vector entity
       *
       *  @function
       *  @param  {number[]|Vector} coords - vector coordinates
       *  @return {Vector}
       */
      vector: function (vec) {
          return primitive('vector', { coords: vecCoords(vec) }, Vector);
      },

      //******************************************************************************
      // Point entity
      //******************************************************************************

      /** Constructs point entity
       *
       *  @function
       *  @param  {number[]|Point} coords - array with point coordinates
       *  @param  {string}         name   - optional, entity id
       *  @return {Point}
       */
      point: function (pt, name) {
          return primitive('point', {
              point: coords(pt),
              id: name || guid()
          }, Point);
      },

      //******************************************************************************
      // Wire entities
      //******************************************************************************

      /** Constructs line entity
       *
       *  @function
       *  @param  {number[]|Point} start - starting point
       *  @param  {number[]|Point} end   - end point
       *  @param  {string}         name  - optional, entity id
       *  @return {Wire}          line entity
       */
      line: function (start, end, name) {
          return primitive('line', {
              start: coords(start),
              end: coords(end),
              startId: getId(start) || guid(),
              endId: getId(end) || guid(),
              id: name || guid()
          }, Wire);
      },
      /** Constructs polyline entity
       *
       *  @function
       *  @param  {...number[]|Point} point - a set of points forming polyline
       *  @return {Wire}                      polyline entity
       */
      polyline: function() {
          return primitive('polyline', {
              points: mapCoords(arguments)
          }, Wire);
      },
      /** Constructs arc entity
       *
       *  @function
       *  @param  {number[]|Point}    start  - start point
       *  @param  {number[]|Point}    middle - middle point
       *  @param  {number[]|Point}    end    - end point
       *  @param  {string}            name   - optional, entity id
       *  @return {Wire}              arc entity
       */
      arc: function (start, middle, end, name) {
          return primitive('arc', {
              start: coords(start),
              middle: coords(middle),
              end: coords(end),
              startId: getId(start) || guid(),
              endId: getId(end) || guid(),
              originId: guid(),
              id: name || guid()
          }, Wire);
      },
      /** Constructs NURBS curve entity
       *
       *  @function
       *  @param  {number} degree - curve's NURBS degree
       *  @param  {string} name   - optional, entity id
       *  @return {Curve}           curve entity
       */
      curve: function(degree, name) {
          return primitive('curve', {
              degree: degree,
              knots: [],
              controlPoints: [],
              id: name || guid()
          },
          Curve);
      },
      /** Constructs circle entity
       *
       *  @function
       *  @param  {number[]|Point}    center - circle center
       *  @param  {number}            r      - radius
       *  @param  {string}            name   - optional, entity id
       *  @return {Wire}            circle entity
       */
      circle: function (center, r, name) {
          return primitive('circle', {
              origin: coords(center),
              originId: getId(center) || guid(),
              radius: r,
              id: name || guid()
          },
          Wire);
      },
      /** Constructs ellipse entity
       *
       *  @function
       *  @param  {number[]|Point}  center
       *  @param  {number}          rMajor - major radius
       *  @param  {number}          rMinor - minor radius
       *  @param  {number[]|Vector} dir    - major direction
       *  @param  {string}          name   - optional, entity id
       *  @return {Wire}
       */
      ellipse: function (center, rMajor, rMinor, dir, name) {
          return primitive('ellipse', {
              origin: coords(center),
              originId: getId(center) || guid(),
              majorRadius: rMajor,
              minorRadius: rMinor,
              direction: (dir ? vecCoords(dir) : undefined),
              id: name || guid()
          },
          Wire);
      },
      /** Constructs rectangle entity
       *
       *  @function
       *  @param  {number[]|Point}  center
       *  @param  {number[]|Vector} span - length of the rectangle along its local x and y axes
       *  @return {Wire}
       */
      rectangle: function (center, span) {
          var c = vecCoords(span);
          if (c.length != 2) {
              throw Error("Expected rectangle dimensions to be 2-dimensional.");
          }
          return primitive('rectangle', { origin: coords(center), dimensions: c }, Wire);
      },
      /** Constructs polycurve entity
       *
       *  Polycurve may represent any wire body, including non-manifold and disjoint
       *
       *  @function
       *  @param  {Wire[]}  curves
       *  @return {Wire}
       */
      polycurve: function (curves) {
          return primitive('polycurve', { curves: curves }, Wire);
      },

      //******************************************************************************
      // Sheet entities
      //******************************************************************************

      /** Constructs polygon set
       *
       *  @function
       *  @return {PolygonSet} polygon set entity
       */
      polygonSet: function () {
          return primitive('polygonSet', { polygons: [] }, PolygonSet);
      },
      /** Constructs NURBS surface
       *
       *  @function
       *  @param  {number}  uDegree - NURBS degree along U parameter
       *  @param  {number}  vDegree - NURBS degree along V parameter
       *  @return {Surface}           NURBS surface entity
       */
      surface: function(uDegree, vDegree) {
          return primitive('surface', {
              uDegree: uDegree,
              vDegree: vDegree,
              uKnots: [],
              vKnots: [],
              controlPoints: []
          }, Surface);
      },
      /** Constructs polysurface entity
       *
       *  Polysurface may represent any sheet or solid body, including non-manifold and disjoint
       *
       *  @function
       *  @param  {Sheet[]}  surfaces
       *  @return {Sheet}
       */
      polysurface: function (surfaces) {
          return primitive('polysurface', { surfaces: surfaces }, Sheet);
      },

      //******************************************************************************
      // Solid entities
      //******************************************************************************

      /** Constructs 3D mesh
       *
       *  @function
       *  @return {Mesh} mesh entity
       */
      mesh: function () {
          return primitive('mesh', { vertices: [], faces: [] }, Mesh);
      },
      /** Constructs 3D solid block
       *
       *  @function
       *  @param  {number[]|Point}  center
       *  @param  {number[]|Vector} dimensions - block dimensions along axes
       *  @return {Solid}
       */
      block: function (center, span) {
          return primitive('block', { origin: coords(center), dimensions: vecCoords(span) }, Solid);
      },
      /** Constructs torus, lying in XY plane
       *
       *  @function
       *  @param  {number[]|Point} center
       *  @param  {number}         rMinor - minor radius
       *  @param  {number}         rMajor - major radius
       *  @return {Solid}
       */
      torus: function (center, minr, majr) {
          return primitive('torus', {
              origin:      coords(center),
              minorRadius: minr,
              majorRadius: majr
          }, Solid);
      },
      /** Constructs sphere
       *
       *  @function
       *  @param  {number[]|Point} center
       *  @param  {number}         radius
       *  @return {Solid}
       */
      sphere: function (c, r) {
          return primitive('sphere', { origin: coords(c), radius: r }, Solid);
      },
      /** Constructs cylinder
       *
       *  @function
       *  @param  {number[]|Point}  center    - center of cylinder's basement
       *  @param  {number}          radius
       *  @param  {number}          height
       *  @return {Solid}
       */
      cylinder: function (c, r, h) {
          return primitive('cylinder', {
              origin:    coords(c),
              radius:    r,
              height:    h
          }, Solid);
      },
      /** Constructs cone
       *
       *  @function
       *  @param  {number[]|Point}  center     - center of cone's basement
       *  @param  {number}          radius
       *  @param  {number}          height
       *  @param  {number}          phi        - semi-angle, in degrees
       *  @return {Solid}
       */
      cone: function (c, r, h, phi) {
          return primitive('cone', {
              origin:       coords(c),
              radius:       r,
              height:       h,
              semiAngle:    phi
          }, Solid);
      },

      //******************************************************************************
      // Other entities
      //******************************************************************************
      /** Constructs affine transformation matrix
       *
       *  @function
       *  @param  {number[]} [matrix] - initial matrix, default is identity matrix
       *  @return {Affine}              affine transformation matrix entity
       */
      affine: function (optMatrix) {
          optMatrix = optMatrix || [
               1, 0, 0, 0 ,
               0, 1, 0, 0 ,
               0, 0, 1, 0 ,
               0, 0, 0, 1
          ];
          return primitive('affineTransform', { mat: optMatrix }, Affine);
      },
      /** Constructs infinite plane
       *
       *  @function
       *  @param  {number[]|Point}  origin - in-plane point
       *  @param  {number[]|Vector} normal - plane's normal vector
       *  @return {Plane}
       */
      plane: function (o, n) {
          return primitive('plane', {
              origin: coords(o),
              normal: vecCoords(n)
          });
      }
  };

  //******************************************************************************
  // Constraints
  //******************************************************************************
  // Helper functions to create json constraints
  function constr1(e) {
      return { entity1: getId(e) };
  }
  function valueConstr1(val, e) {
      return { value: val, entity1: getId(e) };
  }
  function constr2(e1, e2) {
      return { entity1: getId(e1), entity2: getId(e2) };
  }
  function valueConstr2(val, e1, e2) {
      return { value: val, entity1: getId(e1), entity2: getId(e2) };
  }
  function helpConstr2(e1, e2, h1, h2) {
      return { entity1: getId(e1), entity2: getId(e2), help1: h1, help2: h2 };
  }
  function helpParamsConstr2(e1, e2, p1, p2) {
      return { entity1: getId(e1), entity2: getId(e2), helpParam1: p1, helpParam2: p2 };
  }
  function valueHelpConstr2(val, e1, e2, h1, h2) {
      return { value: val, entity1: getId(e1), entity2: getId(e2), help1: h1, help2: h2 };
  }
  function constr3(e1, e2, e3) {
      return { entity1: getId(e1), entity2: getId(e2), entity3: getId(e3) };
  }
  function help(param) {
      if (arguments.length !== 1)
          throw Error("Invalid help parameter " + JSON.stringify(arguments));
      if (Array.isArray(param)) {
          if(param.length !== 0 && param.length !== 3) {
              throw Error("Invalid help point " + JSON.stringify(param));
          }
          return param;
      }
      if (typeof param !== 'number')
          throw Error("Invalid help parameter " + JSON.stringify(param));
      return [param];
  }
  // var constraints is used for self-call
  var constraints =
      /** Constraint constructors
      *  @namespace constraints
      */
  {
      //******************************************************************************
      // Raw constraint, specified directly as JSON
      //******************************************************************************
      /** Constructs constraint object from raw data. No checks for type value, body being object etc.
       *
       *  @param  {*}      body - any JavaScript value
       *  @return {Constraint}
       */
      raw: function(body) {
          var c = new Constraint(body.type);
          c.__data__ = body;
          return c;
      },
      /** Constructs parallel constraint
       *  Defined only for geometries with a direction
       *  It implies that the directions of the geometries are parallel
       *
       *  @function
       *  @param  {Entity} e1     - first entity
       *  @param  {Entity} e2     - second entity
       *  @return {Constraint}      parallel constraint
       */
      parallel: function(e1, e2) {
          return type('parallel', constr2(e1, e2));
      },
      /** Constructs radius constraint
       *  Defined only for circles
       *
       *  @function
       *  @param  {Entity} val    - circle radius value
       *  @param  {Entity} e      - circle entity
       *  @return {Constraint}      radius constraint
       */
      radius: function(val, e) {
          return type('radius', valueConstr1(val, e));
      }
  };
  // Operations
  //******************************************************************************
  var ops =
  /** Operation constructors
   *  This documentation isn't precise on argument and result types,
   *  because functions listed here effectively create operation objects.
   *  So functions here are documented in terms of types
   *  these operations require as arguments and produce as results.
   *  Due to operation nesting and use of direct string identifiers,
   *  each of these functions can receive {@link string}, {@link Operation}
   *  along with types listed in parameter description.
   *  And each of these functions produces {@link Operation} object.
   *  @namespace operations
   */
  {
      /** identity pseudo-operation
       *  Returns its single argument
       *  Used in cases where some entity should be directly mapped to output
       *
       *  @function
       *  @param  {Entity} entry - any entity
       *  @return {Entity}       - entry, unchanged
       */
      identity: function(entry) {
          var r = new Operation('identity');
          r.args = [entry];
          r.toJSON = function () {
              return Operation.prototype.toJSON.call(this)[1];
          };
          return r;
      },
      /** 'list' operation
       *  Accepts arbitrary list of entity/operation arguments
       *  @function
       *  @param  {...Entity} arg - any entity or operation
       *  @return {Entity[]}        list of entities
       */
      list: function() {
          var r = new Operation('list');
          r.args = toArray(arguments);
          return r;
      },
      /** 'repr' operation
       *  Produces Brep object in desired format.
       *  "content" field, which contains actual data, may be zip-packed and base64 encoded
       *  You cannot enable compression and disable base64-coding
       *  Format identifiers supported:
       *  - "x_b":  Parasolid binary format
       *  - "x_t":  Parasolid textual format
       *  - "iges": IGES format
       *  - "step": STEP
       *  - "sat":  SAT
       *  @function
       *  @param  {string}                    format identifier
       *  @param  {Entity}                    entity which should be converted to BREP
       *  @param  {boolean} [is_compressed] - compress content data stream or not, default false
       *  @param  {boolean} [is_base64]     - encode content data stream as base-64 or not, default true
       *  @return {Entity}  BREP
       */
      repr: op('repr', 4),
      /** 'raw' operation
       *  Accepts operation name and variadic list of its arguments directly
       *  Use with caution, only when you know what you do
       *  @function
       *  @param  {string}    name - operation identifier
       *  @param  {...Entity} arg  - any entity or operation
       *  @return {Entity[]}         list of entities
       */
      raw: function() {
          var r = new Operation(arguments[0]);
          r.args = toArray(arguments).slice(1);
          return r;
      },
      /** 'union' operation
       *  Computes union of two geometries
       *  @function
       *  @param  {Sheet|Solid} left
       *  @param  {Sheet|Solid} right
       *  @return {Mesh}        union result
       */
      unite: op('union', 2),
      /** 'intersection' operation
       *  Computes intersection of two geometries
       *  @function
       *  @param  {Sheet|Solid} left
       *  @param  {Sheet|Solid} right
       *  @return {Mesh}        intersection result
       */
      intersect: op('intersection', 2),
      /** 'difference' operation
       *  Subtracts right geometry from the left one
       *  @function
       *  @param  {Sheet|Solid} left  - entity to subtract from
       *  @param  {Sheet|Solid} right - entity being subtracted from left
       *  @return {Mesh}                subtraction result
       */
      subtract: op('difference', 2),
      /** 'evalDist' operation
       *  Computes distance between two geometries
       *  @function
       *  @param  {Point|Wire|Sheet|Solid} left
       *  @param  {Point|Wire|Sheet|Solid} right
       *  @return {number}                 distance between entities
       */
      evalDist: op('evalDist', 2),
      /** 'transform' operation
       *  Transforms 3D entity using affine matrix
       *  @function
       *  @param  {Point|Wire|Sheet|Solid} entity          - entity to transform
       *  @param  {Affine}                 transformation  - 3D affine matrix
       *  @return {Point|Wire|Sheet|Solid}                   first argument, transformed
       */
      transform: op('transform', 2),
      /** 'evalMassProps' operation
       *  Computes mass properties of entity
       *
       *  @function
       *  @param  {Wire|Sheet|Solid} entity
       *  @return {MassProps}        mass properties; not defined in this module because cannot be used as query input
       */
      evalMassProps: op('evalMassProps', 1),
      /** 'trim' operation
       *  Trims surface with a curve
       *  @function
       *  @param  {Sheet} sheet - sheet to be trimmed
       *  @param  {Wire}  curve - closed curve which will trim surface (will be projected onto surface if not resides on it)
       *  @return {Sheet}         trimmed sheet
       */
      trim: op('trim', 2),
      /** 'crossSection' operation
       *  Sections solid or sheet body with surface
       *  The result is a piece of surface which forms section
       *  @function
       *  @param  {Solid|Sheet} body    - solid or sheet body to section
       *  @param  {Plane}       surface - plane or cylinder surface to section with
       *  @return {Sheet}                 resulting cross-section
       */
      crossSection: op('crossSection', 2),
      /** 'intersectBodyWithLine' operation
       *  Computes a list of points where line intersects faces of specified body
       *  Points are ordered by their position on the line, along line's main direction
       *  @function
       *  @param  {Sheet|Solid} body - solid or sheet body to intersect
       *  @param  {Wire}        line - intersection line
       *  @return {Point[]}            list of intersection points
       */
      intersectBodyWithLine: op('intersectBodyWithLine', 2),
      /** 'extrude' operation
       *  Extrudes body along direction, until second body is reached
       *  @function
       *  @param  {Point|Wire|Sheet} profile   - extruded profile
       *  @param  {Sheet|Solid}      bound     - bounding body
       *  @param  {Vector}           direction - extrusion direction
       *  @return {Mesh}
       */
      extrude: op('extrude', 3),
      /** 'extrudeWithDistance' operation
       *  Extrudes body along direction for a specified distance
       *  @function
       *  @param  {Point|Wire|Sheet} body      - extruded profile
       *  @param  {number}           distance  - 'height' of extrusion
       *  @param  {Vector}           direction - extrusion direction
       *  @return {Mesh}
       */
      extrudeWithDistance: op('extrudeWithDistance', 3),
      /** 'sweep' operation
       *  Sweeps wire or sheet profile along guide wire
       *  @function
       *  @param  {Wire[]|Sheet[]} profiles - profiles being swept
       *  @param  {Wire[]}         guides   - guide wires to sweep along
       *  @return {Mesh}
       */
      sweep: op('sweep', 2),
      /** 'loft' operation
       *  Lofts a set of profiles along a set of guide wires
       *  @function
       *  @param  {Wire[]|Sheet[]} profiles      - lofted profiles
       *  @param  {Wire[]}         guides        - lofting guides
       *  @param  {Point[]}        startVertices - starting vertices for lofted profiles
       *  @return {Mesh}
       */
      loft: op('loft', 3),
      /** 'revolve' operation
       *  Spins specified profile around axis based at origin for a specified angle
       *  @function
       *  @param  {Point|Wire|Sheet} profile - spinned profile
       *  @param  {Point}            origin  - rotation center
       *  @param  {Vector}           axis    - rotation axis, which is normal vector to rotation plane
       *  @param  {number}           angle   - spinning angle
       *  @return {Mesh}
       */
      revolve: op('revolve', 4),
      /** 'evalCurveLength' operation
       *  Computes curve length
       *  @function
       *  @param  {Curve}  curve
       *  @return {number}
       */
      evalCurveLength: op('evalCurveLength', 1),
      /** 'tessellate' operation
       *  Converts BREP body to a polygonal mesh
       *  @function
       *  @param  {Solid}    body              - body being tessellated
       *  @param  {number}  [linearTolearance] - the minimum linear size of any detail to be visible
       *  @param  {number}  [angularSize]      - the angle, in degrees, which provided body occupies in field of view
       *  @return {Mesh}
       */
      tesselate: function() {
          var r = new Operation('tessellate');
          r.args = [ arguments[0], arguments[1] || DEFAULT_LINEAR_TOLERANCE, arguments[2] || DEFAULT_ANGULAR_SIZE ];
          return r;
      },
      /** 'tesselateStl' operation
       *  Constructs STL representation of specified BREP
       *  @function
       *  @param  {Body}    body      - body being tessellated
       *  @param  {number}  quality   - tesselation quality, ranges 0-4; the bigger, the better
       *  @return {Entity}  BREP
       */
      tesselateStl: op('tessellateStl', 2),
      /** 'createPolylineApprox' operation
       *  Converts NURBS curve to polyline
       *  @function
       *  @param  {Curve}     curve
       *  @return {Point[]}
       */
      createPolylineApprox: op('createPolylineApprox', 1),
      /** 'mirror' operation
       *  Produces entity that reflected about given origin and direction
       *  @function
       *  @param  {Point|Wire|Sheet|Solid} body
       *  @param  {Point}                  origin
       *  @param  {Vector}                 direction
       *  @return {Point|Wire|Sheet|Solid}
       */
      mirror: op('mirror', 3),
      /** 'createLinearPattern' operation
       *  Produces linear pattern of entity in the given direction
       *  that is separated by spacing parameter
       *  @function
       *  @param  {Point|Wire|Sheet|Solid}  pattern
       *  @param  {Vector}                  direction
       *  @param  {number}                  spacing   - distance between pattern copies
       *  @param  {number}                  nEntities - repetitions count
       *  @return {Point|Wire|Sheet|Solid}
       */
      createLinearPattern: op('createLinearPattern', 4),
      /** 'createCircularPattern' operation
       *  Produces circular pattern of entity in the given direction
       *  that is separated by angle between each instance
       *  @function
       *  @param  {Point|Wire|Sheet|Solid}  pattern
       *  @param  {Point}                   origin
       *  @param  {Vector}                  direction - direction vector in which to create patterns
       *  @param  {number}                  angle     - angle between instances
       *  @param  {number}                  nEntities - repetitions count
       *  @return {Point|Wire|Sheet|Solid}
       */
      createCircularPattern: op('createCircularPattern', 5),
      /** 'createPlanarSheet' operation
       *  Creates a sheet body from a closed curve
       *  @function
       *  @param  {Wire}  curve - closed curve
       *  @return {Sheet}
       */
      createPlanarSheet: op('createPlanarSheet', 1),
       /** 'sectionBody' operation
       *  Sections a body with a plane or a sheet
       *  @function
       *  @param  {Sheet|Solid} target
       *  @param  {Sheet|Plane} tool
       *  @return {Sheet|Solid} the piece of original body from 'back' tool side (opposite to where tool's normal points)
       */
      sectionBody: op('sectionBody', 2),
      /** 'joinCurves' operation
       *  Joins a closed set of wires to form a solitary wire
       *  @function
       *  @param  {...Wire} wire
       *  @return {Wire}
       */
      joinCurves: op('joinCurves', 1),
      /** 'evalCurve' operation
       *  Evaluates a point and derivatives at a given curve parameter
       *  For b-curves, the parameter space is bound by the lowest and highest value in the knot vector.
       *  For other wires parameter spaces are preset as follows:
       *   - Line      - [0, 1]
       *   - Polyline  - [0, 1]
       *   - Rectangle - [0, 1]
       *   - Arc       - [0, 1]
       *   - Circle    - [0, 2Pi]
       *   - Ellipse   - [0, 2Pi]
       *  Circles and ellipses are always periodic, so it is possible to pass values beyond this interval.
       *  @function
       *  @param  {Curve}   curve
       *  @param  {number}  t       - parameter on curve
       *  @param  {number}  nDerivs - number of derivatives
       *  @return {Point[]}           a point and N derivatives
       */
      evalCurve: op('evalCurve', 3),
      /** 'evalSurface' operation
       *  Evaluates a point and derivatives at a given surface parameter pair
       *  @function
       *  @param  {Sheet}   surface
       *  @param  {number}  u        - surface parameter
       *  @param  {number}  v        - surface parameter
       *  @param  {number}  nUDerivs - derivatives count along U parameter
       *  @param  {number}  nVDerivs - derivatives count along V parameter
       *  @return {Point[]}            result point and its nU*nV-1 derivatives
       */
      evalSurface: op('evalSurface', 5),
      /** 'makeSubCurve' operation
       *  Creates a curve based on an existing curve's parameter interval
       *  For b-curves, the parameter space is bound by the lowest and highest value in the knot vector.
       *  For other wires parameter spaces are preset as follows:
       *   - Line      - [0, 1]
       *   - Polyline  - [0, 1]
       *   - Rectangle - [0, 1]
       *   - Arc       - [0, 1]
       *   - Circle    - [0, 2Pi]
       *   - Ellipse   - [0, 2Pi]
       *  Circles and ellipses are always periodic, so it is possible to pass values beyond this interval.
       *  @function
       *  @param  {Curve}  curve
       *  @param  {number} t0    - subrange start
       *  @param  {number} t1    - subrange end
       *  @return {Curve}          sub-curve from t0 to t1
       */
      makeSubCurve: op('makeSubCurve', 3),
      /** 'makeSubSurface' operation
       *  Creates a sub-surface based on an existing surface's parameter box
       *  @function
       *  @param  {Sheet}  surface
       *  @param  {number} u0 - U subrange start
       *  @param  {number} u1 - U subrange end
       *  @param  {number} v0 - V subrange start
       *  @param  {number} v1 - V subrange end
       *  @return {Sheet}       sub-sheet in ([u0, u1], [v0, v1]) box
       */
      makeSubSurface: op('makeSubSurface', 5),
      /** 'intersectCurves' operation
       *  Finds all intersections between two curves
       *  @function
       *  @param  {Curve}   curve1
       *  @param  {Curve}   curve2
       *  @return {Point[]} intersections list
       */
      intersectCurves: op('intersectCurves', 2),
      /** 'offsetBody' operation
       *  'Bloats' sheet or solid body by offsetting all its faces by specified distance, using faces' normals as directions
       *  @function
       *  @param  {Sheet|Solid} body
       *  @param  {number}      distance
       *  @return {Sheet|Solid}
       */
      offsetBody: op('offsetBody', 2),
      /** 'offsetWire' operation
       *  'Bloats' planar wire body by offsetting its pieces by specified distance
       *  @function
       *  @param  {Wire}   wire     - wire, must lie in one plane
       *  @param  {number} distance - distance to offset
       *  @param  {Vector} normal   - normal to wire's plane
       *  @return {Wire}
       */
      offsetWire: op('offsetWire', 3),
      /** 'createProfiles' operation
       *  Creates a wire or sheet body from a set of wires
       *  @function
       *  @param  {Wire[]}     profiles
       *  @param  {number}     sheetFlag - 0 for wire result, otherwise sheet
       *  @return {Wire|Sheet}             cannot be exported, only usable as input for other operations
       */
      createProfiles: op('createProfiles', 2),
      /** 'compareCurves' operation
       *  Checks if two NURBS curves are equal
       *  Following wires are considered NURBS geometry: lines, polylines, arcs, curves, rectangles.
       *  Returns "1" if wires have equal knots, points and degrees, "0" otherwise.
       *  @function
       *  @param  {Curve}   curve1
       *  @param  {Curve}   curve2
       *  @return {Number}  "1" if equal, "0" otherwise
       */
      compareCurves: op('compareCurves', 2),
      /** 'createResilientProfiles' operation
       *  Creates profiles which inner loops are removed
       *  @function
       *  @param  {Wire[]}  profiles
       *  @return {Sheet}   profile
       */
      createResilientProfiles: op('createResilientProfiles', 1),
      /** 'eval' operation
       *  Evaluates entire scene inside DCM-Worker
       *  @function
       *  @return {DCM/Scene} scene
       */
      eval: function() {
          return new Operation('eval');
      }
  };

  // Helper function
  function getCircleCenterByThreePoints(start, middle, end)
  {
      // All z-coords are taken to be 0
      // Not valid for real 3d arc

      var offset = Math.pow(middle[0], 2) + Math.pow(middle[1], 2);
      var bc = (Math.pow(start[0], 2) + Math.pow(start[1], 2) - offset) / 2.0;
      var cd = (offset - Math.pow(end[0], 2) - Math.pow(end[1], 2)) / 2.0;
      var det = (start[0] - middle[0]) * (middle[1] - end[1]) - (middle[0] - end[0]) * (start[1] - middle[1]);
      if (Math.abs(det) < eps) {
          throw Error("Cannot get circle center by three points [" +
              start[0] + ", " + start[1] + "], [" + middle[0] + ", " +
              middle[1] + "], [" + end[0] + ", " + end[1] + "]");
      }
      var idet = 1.0/det;

      var centerX =  (bc * (middle[1] - end[1]) - cd * (start[1] - middle[1])) * idet;
      var centerY =  (cd * (start[0] - middle[0]) - bc * (middle[0] - end[0])) * idet;

      return [centerX, centerY, 0.0];
  }

  module.exports = {
      init: init,
      gen_id_object: gen_id_object,
      scene: scene,
      dcmScene: dcmScene,
      attributes: attributes,
      utilities: utilities,
      entities: entities,
      constraints: constraints,
      operations: ops
  };
  });

  var modeling = (modelingCore && typeof modelingCore === 'object' && 'default' in modelingCore ? modelingCore['default'] : modelingCore);

  /**
   * Sets the content type and the request token header on a XMLHttpRequest
   * object.
   *
   * @function setHeaders
   *
   * @param {XMLHttpRequest} request The request object
   * @param {String} contentType The content type that should be set
   */
  function setHeaders(request, contentType) {
      request.setRequestHeader('Content-Type', contentType);
      request.setRequestHeader('Flux-Request-Marker', '1');
      var token = _parseCookies(document.cookie).flux_token;
      request.setRequestHeader('Flux-Request-Token', token);
  }

  /**
   * Parses the form of document.cookies into an object.
   *
   * For CSRF protection, client needs to set Flux-Request-Marker and
   * Flux-Request-Token headers on all authenticated requests.
   *
   * Flux-Request-Marker: 1
   * Flux-Request-Token: <token>
   *
   * where <token> echoes the value of the flux_token cookie
   * (set by the head proxy at auth).
   *
   * This pulls out that token value and stores it on Flux.fluxToken (for
   * use by other request senders) and sets headers on jquery ajax requests.
   *
   * Cookie parsing taken from https://github.com/jshttp/cookie

   *
   * @function _parseCookies
   * @private
   *
   * @return {Object} A set of key value pairs from the cookies
   *
   * @param {string} str A string having the form of document.cookies.
   * @param {Function} options Provider of a decode function that behaves
   *                           like decodeURIComponent. If options.decode is
   *                           not provided, decodeURIComponent is used.
   */
  function _parseCookies(str, options) {
    var obj = {};
    var opt = options || {};
    var pairs = str.split(/; */);
    var dec = opt.decode || decodeURIComponent;
    var pair, eq_idx, key, val;

    for ( var i = 0, len = pairs.length ; i < len ; i++ ) {

      pair = pairs[i];

      eq_idx = pair.indexOf('=');

      // skip things that don't look like key=value
      if (eq_idx < 0) {
        break;
      }

      key = pair.substr(0, eq_idx).trim();
      val = pair.substr(++eq_idx, pair.length).trim();

      // quoted values
      if ('"' == val[0]) {
        val = val.slice(1, -1);
      }

      // only assign once
      if (obj[key] == null) {
        obj[key] = _tryDecode(val, dec);
      }

    }

    return obj;
  }

  /**
   * Attempts to decode a string with the provided function.
   * Catches errors and returns input string on failure.
   *
   * @function _tryDecode
   * @private
   *
   * @return {String} The decoded or undecoded string
   *
   * @param {String} str The string to try to decode
   * @param {Function} decode The function to decode with
   */
  function _tryDecode(str, decode) {
    try {
      return decode(str);
    } catch (e) {
      return str;
    }
  }

  /**
  * Stand in for the finished status on an xhr
  */
  var READY_STATE_FINISHED = 4;

  // Array of enviroment textures for image-based lighting.
  // Singleton
  // Cubemap textures are pre-filtered to simulate different levels of light diffusion.
  // More about the technique:
  // http://developer.amd.com/tools-and-sdks/archive/legacy-cpu-gpu-tools/cubemapgen/
  var iblCubeArray = [
      new THREE.Texture(), // 512x512
      new THREE.Texture(), // 256x256
      new THREE.Texture(), // 128x128
      new THREE.Texture(), // 61x64
      new THREE.Texture(), // 32x32
      new THREE.Texture(), // 16x16
      new THREE.Texture(), // 8x8
      new THREE.Texture(), // 4x4
      new THREE.Texture()  // 2x2
  ];

  // Loads pre-filtered textures
  function loadImages(path) {
      return new Promise(function (resolve) {
          THREE.ImageUtils.crossOrigin = true;
          var loadedImageCount = 0;
          for (var i = 0; i <= 8; i++) {
              var iblCubeUrls = [
                  path + '_m0' + i + '_c00.png',
                  path + '_m0' + i + '_c01.png',
                  path + '_m0' + i + '_c02.png',
                  path + '_m0' + i + '_c03.png',
                  path + '_m0' + i + '_c04.png',
                  path + '_m0' + i + '_c05.png'
              ];
              iblCubeArray[i] = THREE.ImageUtils.loadTextureCube(iblCubeUrls, undefined, function() {
                  loadedImageCount++;
                  if (loadedImageCount === 9) {
                      resolve();
                  }
              });
              iblCubeArray[i].format = THREE.RGBFormat;
          }
      });
  }

  // Singleton promise for async loading
  var imagesLoadingPromise = null;

  /**
  * Flux geometry class converts parameter objects to geometry
  * @param {String} tessUrl The url for the brep tessellation service
  * @param {String} iblUrl The url for image based lighting textures
  * @constructor
  */
  function FluxGeometryBuilder(tessUrl, iblUrl) {

      // String path to tessellation API endpoint
      this._parasolidUrl = tessUrl;
      this._imagesUrl = iblUrl;

      // Flag to track whether a request is in the works
      // This causes subsequent requests to this object to be ignored
      // TODO(Kyle): This will no longer be necessary once we get rid of polymer and/or each request isn't set twice
      this.running = false;

      // quality   - tesselation quality, ranges 0-4; the bigger, the better
      this.tessellateQuality = 2.0;
  }

  /**
  * Create a new model for the given entities.
  *
  * @precondition: !this.running
  * Note: The results of this function are stored as member variables,
  * so you must check running before calling convert repeatedly
  * on the same instance or race conditions can occur.
  *
  * @param {Object} entities The parameters objects
  * @return {Promise} A promise object that sets the model when it completes
  */
  FluxGeometryBuilder.prototype.convert = function(entities) {
      var _this = this;
      this.running = true;
      var hasRoughness = FluxJsonToThree.hasRoughness(entities);
      if (hasRoughness && !imagesLoadingPromise && this._imagesUrl) {
          imagesLoadingPromise = loadImages(this._imagesUrl);
      }
      return Promise.resolve(imagesLoadingPromise).then(function () {
          return _this.convertHelper(entities);
      });
  };

  /**
   * Function that actually does conversion once assets have loaded
   * @param {Array} entities Array of entities or arrays
   * @return {Promise} Promise to resolve when geometry is ready
   */
  FluxGeometryBuilder.prototype.convertHelper = function(entities) {
      var geometryResults = new FluxJsonToThree.GeometryResults();
      geometryResults.cubeArray = iblCubeArray;

      if (entities == null || typeof entities != 'object') {
          this.running = false;
          return Promise.resolve(geometryResults);
      }

      // sync - process geometric primitives
      this._parasolidCreateObject(entities, geometryResults);

      // async - tessellate breps on the server
      var _this = this;
      return Promise.resolve(this._handleAsyncGeom(geometryResults).then(function (results) { // resolve
          return results;
      }).catch(function (results) { // reject
          if (results instanceof Error) {
              console.warn(results.stack); // eslint-disable-line no-console
          }
          return geometryResults;
      })).then(function (results) { // resolve
          _this.running = false;
          return results;
      });
  };

  /**
   * Create THREE.js objects from data in the Flux JSON format.
   * The data defines Parasolid Entities.
   * More info on Parasolid Entities can be found here:
   * https://bitbucket.org/vannevartech/parasolid-worker/src/010e74872145b3ac97b221acdca37d9746e88276/doc/ENTITIES.md
   * @param    {Object}    data    The geometry data as objects
   * @param    {GeometryResults}    geometryResults    Geometry and errors object
   */
  FluxGeometryBuilder.prototype._parasolidCreateObject = function(data, geometryResults) {
      try {
          FluxJsonToThree.createObject(data, geometryResults);
      }
      catch(err) {
          this._handleInvalidPrims(data, err, geometryResults);
      }
  };

  /**
   * Provide error handling to determine invalid prims user message
   * @param    {Object} data    The geometry that was attempted to parse
   * @param    {Error}    err     Exception object from try catch
   * @param    {GeometryResults} geometryResults    Contains and geometry and errors
   */
  FluxGeometryBuilder.prototype._handleInvalidPrims = function(data, err, geometryResults) {
      var errorMessage = 'Unknown error';
      if (err.name !== 'FluxGeometryError') {
          this.running = false;
          // An unknown error occurred
          throw err;
      } else {
          errorMessage = err.message;
      }

      if (data && data.primitive) {
          geometryResults.primStatus.appendError(data.primitive, errorMessage);
      } else {
          geometryResults.primStatus.appendError('unknown', errorMessage);
      }
  };

  /**
   * Send a request to tessellate breps, and add them to the scene.
   *
   * This server currently aborts when there is an error in the tessellation operation, but in the
   * future it could respond with status 200, but contain a mix of successful and failed
   * tesselations. In those mixed cases resolve is called, but the error status is still
   * available on the returned geometryResults object.
   *
   * @param {Object} geometryResults The container for meshes, errors, and entities
   * @return {Promise}     A promise that resolves when the geometry is loaded
   */
  FluxGeometryBuilder.prototype._handleAsyncGeom = function(geometryResults) {
      var _this = this;
      // Create a promise for the operation to tessellate all entities
      return new Promise(function(resolve, reject) {
          if (geometryResults.asyncPrims.length > 0) {
              _this._tessellateValues(geometryResults).then(function (tessResponse) { // resolve
                  var resultObj = JSON.parse(tessResponse.result);
                  var errors = resultObj.Errors;
                  _this._handleBrepErrors(errors, geometryResults, tessResponse);
                  _this._handleBrepResults(resultObj, geometryResults, tessResponse);
                  resolve(geometryResults);
              }).catch(function (response) { // reject
                  if (response instanceof Error) {
                      console.warn(response.stack); // eslint-disable-line no-console
                      geometryResults.primStatus.appendError('brep', response.message);
                      reject(geometryResults);
                  } else {
                      if (response.readyState >= READY_STATE_FINISHED) {
                          geometryResults.primStatus.appendError('brep', _this._interpretServerErrorCode(response.status, response.responseText));
                      } else {
                          geometryResults.primStatus.appendError('brep', 'Duplicate request was aborted.');
                      }
                  }
                  reject(geometryResults);
              });
          } else {
              resolve(geometryResults);
          }
      });
  };

  /**
   * Parse errors and update status map
   * @param  {Object} errors          Parasolid errors map
   * @param  {GeometryResults} geometryResults   Results container
   * @param  {Object} tessResponse    Server response
   */
  FluxGeometryBuilder.prototype._handleBrepErrors = function (errors, geometryResults, tessResponse) {
      // There were invalid breps or other server errors
      if (errors && Object.keys(errors).length > 0) {
          var fullErrorMessage = errors[Object.keys(errors)[0]].Message;
          // Set the server error as the invalid prim message
          geometryResults.primStatus.appendError(
              tessResponse.primitives[this._findErroredPrim(fullErrorMessage)],
              this._interpretServerError(fullErrorMessage));
      }
  };

  /**
   * Take meshes as data objects from Parasolid and convert them to renderable geometry
   * @param  {Object} resultObj       Container for meshes data
   * @param  {GeometryResults} geometryResults   Results container
   * @param  {Object} tessResponse    Server response
   */
  FluxGeometryBuilder.prototype._handleBrepResults = function (resultObj, geometryResults, tessResponse) {
      // There were valid breps that tessellated
      if (resultObj.Output.Results) {
          var data = resultObj.Output.Results.value;
          for (var key in data) {
              var primitive = tessResponse.primitives[key];
              geometryResults.primStatus.appendValid(primitive);
              var primObj = data[key];
              var stlAscii = window.atob(primObj.content);
              var stlData = {
                  primitive:primObj.format,
                  data:stlAscii
              };
              // This function adds the results as children of geometryResults.mesh
              FluxJsonToThree.createObject(stlData, geometryResults);
          }
      }
  };

  /**
   * Asynchronously request a tessellated model from the back end service.
   * @precondition Each value is a brep entity with a primitive property
   * @param    {GeometryResults} geometryResults Results container with async primitives unhandled from previous call
   * @return {Promise}     A promise that resolves when the geometry is loaded
   */
  FluxGeometryBuilder.prototype._tessellateValues = function (geometryResults) {
      // Flat array of Flux entity objects
      var values = geometryResults.asyncPrims;
      if (!values || values.constructor !== Array) {
          return Promise.resolve(geometryResults);
      }
      // Keep track of the primitive names in the values array
      var primitives = {};
      var sceneStr = this._constructScene(geometryResults, values, primitives);

      var xhr = new XMLHttpRequest();
      var xhrPromise = new Promise(function (resolve, reject) {
          var resultObj = {'result': '', 'primitives': primitives};
          xhr.onreadystatechange = function() {//Call a function when the state changes.
              if(xhr.readyState !== READY_STATE_FINISHED) return;
              if (xhr.status == 200) {
                  resultObj.result = this.responseText;
                  resolve(resultObj);
              } else {
                  reject(new Error('Server error '+xhr.status+' '+xhr.responseText ));
              }
          };
      });
      xhr.open('POST', this._parasolidUrl);
      setHeaders(xhr, 'application/json');
      xhr.send(sceneStr);

      // Check if this module already has a pending request and cancel it
      if (this._lastTessRequest &&
              this._lastTessRequest.readyState < READY_STATE_FINISHED) {
          this._lastTessRequest.abort();
      }
      this._lastTessRequest = xhr;

      return xhrPromise;
  };

  /**
   * Construct a scene object to format the request for brep tessellation
   * @param  {GeometryResults} geometryResults Results container
   * @param  {Array} values List of primitives to tessellate
   * @param  {Object} primitives Keep track of the primitive names in the values array.
   *                             This is a map so that in the case of a server error the primitives
   *                             can be looked up based on server message which contains their
   *                             resultId string, which is a unique identifier
   * @return {String} Text describing the operations formatted for the query to be sent to parasolid
   */
  FluxGeometryBuilder.prototype._constructScene = function (geometryResults, values, primitives) {
      var scene = modeling.scene();
      for (var i=0; i<values.length; i++) {
          var value = values[i];
          if (!value || !value.primitive) continue;
          var resultId = 'result'+i;
          scene.add(resultId, value);
          var tessOp = modeling.operations.tesselateStl(resultId, this.tessellateQuality);
          // The first argument must be a unique id. It is an integer
          // so it can be used to look up the primitive later.
          scene.add(resultId, tessOp);
          primitives[resultId] = value.primitive;
      }
      if (Object.keys(primitives).length === 0) {
          return Promise.resolve(geometryResults);
      }
      return JSON.stringify({'Scene':scene});
  };

  /**
   * Parse server error message and interpret to be human readable.
   * Eventually the sever might have better messages:
   * https://vannevar.atlassian.net/browse/GI-1933
   * @param    {String} text The full error text
   * @return {String}            The improved error message
   */
  FluxGeometryBuilder.prototype._interpretServerError = function (text) {
      var errorMessage = text.slice(0, text.indexOf('\n'));
      // Add a more clear explanation for this specific error
      if (errorMessage === 'PK_ERROR_wrong_transf') {
          errorMessage = 'Flux is currently unable to model objects '+
                  'that are outside of a bounding box that is 1000 units '+
                  'wide centered at the origin. Please scale down your '+
                  'models or change units.';
      } else if (errorMessage === 'Translator loader error') {
          errorMessage = 'The brep translator could not be initialized. '+
                  'Perhaps the license has expired. Please contact Flux to get '+
                  'this resolved.';
      }
      return 'Server error: '+errorMessage;
  };

  /**
   * Workaround for finding the prim associated with the error.
   * The backend does not have a good API for this yet.
   * https://vannevar.atlassian.net/browse/PLT-4228
   * @param    {String} text The full error text
   * @return {String}            The primitive name
   */
  FluxGeometryBuilder.prototype._findErroredPrim = function (text) {
      var match = text.match(/\/result.*\n/);
      return match ? match[0].slice(1, match[0].length-1) : '';
  };

  /**
   * Create a user error message based on status codes
   * @param    {String} status The error html status code
   * @param    {String} text The full error text
   * @return {String}            The error message
   */
  FluxGeometryBuilder.prototype._interpretServerErrorCode = function (status, text) {
      if (status === 504) {
          return "Server error: Your request exceeded the maximum time limit for execution.";
      }
      console.warn("Server error in tessellation. Status:",status,":",text); // eslint-disable-line no-console
      return "Server error: The brep tessellation service is unavailable.";
  };

  /**
   * UI widget to render 3D geometry
   * @param {Element}   domParent     The div container for the canvas
   * @param {Object}    optionalParams Object containing all other parameters
   * @param {Number}    optionalParams.width         The width of the canvas
   * @param {Number}    optionalParams.height        The height of the canvas
   * @param {String}    optionalParams.tessUrl       The url for making brep tessellation requests
   * @param {String}    optionalParams.iblUrl        The url to get textures for image based lighting
   */
  function FluxViewport (domParent, optionalParams) {

      var width;
      var height;
      var tessUrl;
      var iblUrl;
      if (optionalParams) {
          width = optionalParams.width;
          height = optionalParams.height;
          tessUrl = optionalParams.tessUrl;
          iblUrl = optionalParams.iblUrl;
      }

      var renderWidth = 100;//px
      if (width == null) {
          renderWidth = domParent.clientWidth;
      } else {
          renderWidth = Math.max(renderWidth, width);
      }

      var renderHeight = 100;//px
      if (height == null) {
          renderHeight = domParent.clientHeight;
      } else {
          renderHeight = Math.max(renderHeight, height);
      }

      if (!domParent) {
          throw new Error('domParent must be specified to FluxViewport');
      }

      this._geometryBuilder = new FluxGeometryBuilder(tessUrl, iblUrl);

      this._renderer = new FluxRenderer(domParent, renderWidth, renderHeight);
      this._initCallback();

      // Make sure to render on mouse over in case the renderer has swapped contexts
      var _this = this;
      domParent.addEventListener('mouseenter', function(){
          _this.render();
      });

      // Cache of the Flux entity objects for downloading
      this._entities = null;

      // Track the last blob that was downloaded for memory cleanup
      this._downloadUrl = null;

      // Whether the viewport is locked on the current geometry and will automatically focus on new geometry when updating the entities
      this._autoFocus = true;
  }

  FluxViewport.prototype = Object.create( THREE.EventDispatcher.prototype );
  FluxViewport.prototype.constructor = FluxViewport;

  /**
   * Enumeration of edges rendering modes
   * @return {Object} enumeration
   */
  FluxViewport.getEdgesModes = function () {
      return EdgesHelper.EDGES_MODES;
  };

  /**
   * Name of the event fired when the camera changes
   * @return {String} Event name
   */
  FluxViewport.getChangeEvent = function () {
      return FluxRenderer.CHANGE_EVENT;
  };

  //---- Class member functions

  /**
   * Set up the callback to render when the camera changes
   */
  FluxViewport.prototype._initCallback = function() {
      var _this = this;
      this._renderer.addEventListener(FluxRenderer.CHANGE_EVENT, function(event) {
          _this.dispatchEvent( event );
          _this.render();
      });
  };

  /**
   * Actually render the geometry!
   */
  FluxViewport.prototype.render = function() {
      this._renderer.doRender();
  };

  /**
   * Focus the camera on the current geometry
   */
  FluxViewport.prototype.focus = function() {
      this._renderer.focus();
  };

  /**
   * Restore the camera to a default location
   */
  FluxViewport.prototype.homeCamera = function() {
      this._renderer.homeCamera();
  };

  /**
   * Set the viewport geomtery from a JSON string
   * @param {String} dataString The geometry to render formatted as JSON containing Flux entities
   * @return {Object} Promise to resolve after geometry is created
   */
  FluxViewport.prototype.setGeometryJson = function(dataString) {
      var dataObj = JSON.parse(dataString);
      return this.setGeometryEntity(dataObj);
  };

  /**
   * Set the viewport geometry from a data object containing Flux entities
   * @param {Object} data The geometry entities to render
   * @return {Object} Promise to resolve after geometry is created
   */
  FluxViewport.prototype.setGeometryEntity = function(data) {
      var _this = this;
      // The flow sends the same value twice, so we assume that requests
      // sent while there is already one pending are redundant
      // TODO(Kyle): This is a hack that we can remove once there are not always duplicate requests
      return new Promise(function (resolve, reject) {
          if (!_this._geometryBuilder.running) {
              return _this._geometryBuilder.convert(data).then(function (results) {
                  _this._entities = results.meshIsEmpty() ? null : data;
                  _this._updateModel(results.getMesh());
                  resolve(results);
              });
          } else {
              reject(new Error('Already running. You can only convert one entity at a time.'));
          }
      });
  };

  /**
   * Change the geometry being rendered
   * @param  {THREE.Object3D} newModel The new model to render
   * @param  {THREE.Object3D} oldModel The old model to remove
   */
  FluxViewport.prototype._updateModel = function(newModel) {
      this._renderer.setModel(newModel);
      if (this._autoFocus) {
          this.focus(); // changing the controls will trigger a render
          this._autoFocus = false;
      } else {
          this.render();
      }
  };

  /**
   * Make serializable by pruning all references and building an object property tree
   * @return {Object} Data to stringify
   */
  FluxViewport.prototype.toJSON = function() {
      var serializableState = {
          entities: this._entities,
          renderer: this._renderer.toJSON(),
          autoFocus: this._autoFocus
      };
      return serializableState;
  };

  /**
   * Take a data object and use it to update the viewport's internal state
   * Warning this is async when it sets entities
   * @param  {Object} state The properties to set
   * @return {Promise} Completion promise
   */
  FluxViewport.prototype.fromJSON = function(state) {
      if (!state) return Promise.resolve();
      var _this = this;
      if (state.entities) {
          return this.setGeometryEntity(state.entities).then(function () {
              _this.fromJSONHelper(state);
          });
      } else {
          this.fromJSONHelper(state);
          return Promise.resolve();
      }
  };

  /**
   * Rehydrate everything but the entities.
   * @param  {Object} state Parameter data
   */
  FluxViewport.prototype.fromJSONHelper = function(state) {
      if (state.renderer != null) {
          this._renderer.fromJSON(state.renderer);
      }
      if (state.autoFocus != null) {
          this._autoFocus = state.autoFocus;
      }
  };

  /**
   * Download all the geometry settings and raster image that are the state of this viewport.
   * Used for quality assurance testing.
   * @param  {String} prefix File name prefix for download path
   */
  FluxViewport.prototype.downloadState = function(prefix) {
      this._downloadJson(this.toJSON(), prefix);
      this._download(this._renderer.getGlCanvas().toDataURL('image/png'), prefix+'.png');
  };

  /**
   * Helper function to download some data from a url
   * @param  {DOMString} dataUrl  The url containing the data to download
   * @param  {String} filename The name of the file when it downloads
   */
  FluxViewport.prototype._download = function(dataUrl, filename) {
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
  };

  /**
   * Create a link and a temporary blob url to use to download from.
   * @param  {Object} data   The serializable data to write as JSON
   * @param  {String} prefix The file name prefix
   */
  FluxViewport.prototype._downloadJson = function(data, prefix) {
      if (this._downloadUrl) {
          window.URL.revokeObjectURL(this._downloadUrl);
      }
      var jsonString = JSON.stringify(data, null, 2);
      this._downloadUrl = window.URL.createObjectURL(new Blob([jsonString]), {type: 'text/json'});
      this._download(this._downloadUrl, prefix+'.json');
  };

  /**
   * Create a default 3 light rig on the renderer's scene.
   */
  FluxViewport.prototype.setupDefaultLighting = function() {
      var lighting = new THREE.Object3D();
      lighting.name = 'Lights';

      //TODO(Kyle) non static lighting
      this._keyLight = new THREE.DirectionalLight();
      this._keyLight.position.set(60, 80, 50);
      this._keyLight.intensity = 0.95;
      lighting.add(this._keyLight);

      var backLight = new THREE.DirectionalLight();
      backLight.position.set(-250, 50, -200);
      backLight.intensity = 0.4;
      lighting.add(backLight);

      var fillLight = new THREE.DirectionalLight();
      fillLight.position.set(-500, -500, 0);
      fillLight.intensity = 0.7;
      lighting.add(fillLight);

      this._renderer.setLights(lighting);
  };

  //---- Pass through functions

  /**
   * Set the size of the render canvas
   * @param {Number} width  Pixels
   * @param {Number} height Pixels
   */
  FluxViewport.prototype.setSize = function(width, height) {
      this._renderer.setSize(width, height);
  };

  /**
   * Set the background color of the render canvas
   * @param {THREE.color} color Background color
   */
  FluxViewport.prototype.setClearColor = function(color) {
      this._renderer.setClearColor(color);
  };

  /**
   * Set which camera view to use (ex perspective, top etc.)
   * @param {String} view Name of the camera view to use
   */
  FluxViewport.prototype.setView = function(view) {
      this._renderer.setView(view);
      this.focus();
  };

  /**
   * Return the views enumeration
   * @return {Object} Enumeration of view options for cameras
   */
  FluxViewport.getViews = function() {
      return FluxCameras.VIEWS;
  };

  /**
   * Set the density of the exponential fog. Generally on the order of 0.0001
   * @param {Number} density How much fog
   */
  FluxViewport.prototype.setFogDensity = function(density) {
      this._renderer._fog.density = density;
  };

  /**
   * Set the url of the tessellation service.
   *
   * This is required for rendering of breps.
   *
   * @param {String} newUrl The url of the tessellation server
   */
  FluxViewport.prototype.setTessUrl = function(newUrl) {
      this._geometryBuilder._parasolidUrl = newUrl;
  };

  /**
   * Set whether the geometry should focus the geometry when it is changed
   * @param {Boolean} focus Whether to auto focus
   */
  FluxViewport.prototype.setAutoFocus = function(focus) {
      this._autoFocus = focus;
  };

  /**
   * Get whether the geometry should focus the geometry when it is changed
   * @return {Boolean} Whether to auto focus
   */
  FluxViewport.prototype.getAutoFocus = function() {
      return this._autoFocus;
  };

  /**
   * Set the edges rendering mode for hidden line rendering
   * @param  {FluxViewport.EDGES_MODES} mode Whether to render front, back, both or none
   */
  FluxViewport.prototype.setEdgesMode = function(mode) {
      this._renderer.setEdgesMode(mode);
  };

  /**
   * Get the canvas for use in QA scripts
   * @return {Canvas} WebGL canvas dom element
   */
  FluxViewport.prototype.getGlCanvas = function() {
      return this._renderer.getGlCanvas();
  };

  /**
   * Turn on shadow rendering.
   * Warning: This is an experimental feature that may not work.
   */
  FluxViewport.prototype.activateShadows = function() {
      if (!this._keyLight) return;

      this._renderer.setShadowLight(this._keyLight);
      this._renderer.addShadows();
  };

  return FluxViewport;

}());