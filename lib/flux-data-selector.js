var FluxDataSelector = (function() {

var sdk;
var dataTables = {};
var websocketCallbackHandlers = {};

var DataSelector = function DataSelector(clientId, redirectUri, config) {
    this.exampleDataTable = {};
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    if (config) {
        this.exampleDataTable = config.exampleData
        this.setOnInitialCallback = config.setOnInitial;
        this.setOnLoginCallback = config.setOnLogin;
        this.setOnExamplesCallback = config.setOnExamples;
        this.setOnProjectsCallback = config.setOnProjects;
        this.setOnKeysCallback = config.setOnKeys;
        this.setOnValueCallback = config.setOnValue;
        this.setOnNotificationCallback = config.setOnNotification;
    }
}

DataSelector.prototype = {
    // Initialization
    init: init,

    // Configuration functions.
    setExampleData: setExampleData,
    setOnInitial: setOnInitial,
    setOnLogin: setOnLogin,
    setOnExamples: setOnExamples,
    setOnProjects: setOnProjects,
    setOnKeys: setOnKeys,
    setOnValue: setOnValue,
    setOnNotification: setOnNotification,

    // User actions.
    login: login,
    logout: logout,
    showExamples: showExamples,
    showProjects: showProjects,
    selectExample: selectExample,
    selectProject: selectProject,
    selectKey: selectKey,
    updateKey: updateKey,
    createKey: createKey,

    // Helper functions.
    getSDK: getSDK,
    getFluxValue: getFluxValue,
}

function init() {
    getSDK(this.clientId, this.redirectUri);
    var credentials = getFluxCredentials();
    if (!credentials) {
        if (window.location.hash.match(/access_token/)) {
            sdk.exchangeCredentials(getState(), getNonce())
            .then(function(credentials) {
                setFluxCredentials(credentials);
            })
            .then(function() {
                console.log('Flux Login Succeeded. Redirecting again to ' + this.redirectUri + ' ...');
                window.location.replace(this.redirectUri);
            }.bind(this));
        } else {
            if (this.setOnInitialCallback) { this.setOnInitialCallback(); }
        }
    } else {
        if (this.setOnLoginCallback) { this.setOnLoginCallback(); }
    }
}

function getSDK(clientId, redirectUri) {
    if (!sdk) {
        sdk = new FluxSdk(clientId, {
          fluxUrl: 'https://flux.io',
          redirectUri: redirectUri
        });
    }

    return sdk;
}

function login() {
    var credentials = getFluxCredentials();
    if (!credentials) {
        if (!window.location.hash.match(/access_token/)) {
            window.location.replace(sdk.getAuthorizeUrl(getState(), getNonce()));
        }
    } else {
        console.log('You have already logged in to Flux.');
    }
}

function logout() {
    closeWebsocketConnections();
    localStorage.removeItem('fluxCredentials');
    localStorage.removeItem('state');
    localStorage.removeItem('nonce');
    this.setOnInitialCallback();
}

function setExampleData(label, data) {
    this.exampleDataTable[label] = data;
}

function setOnInitial(callback) {
    this.setOnInitialCallback = callback;
}

function setOnLogin(callback) {
    this.setOnLoginCallback = callback;
}

function setOnExamples(callback) {
    this.setOnExamplesCallback = callback;
}

function setOnProjects(callback) {
    this.setOnProjectsCallback = callback;
}

function setOnKeys(callback) {
    this.setOnKeysCallback = callback;
}

function setOnValue(callback) {
    this.setOnValueCallback = callback;
}

function setOnNotification(callback) {
    this.setOnNotificationCallback = callback;
}


function showExamples() {
    this.setOnExamplesCallback(listExampleData.bind(this)());
}

function showProjects() {
    this.setOnProjectsCallback(listFluxProjects.bind(this)());
}

function selectExample(label) {
    // Wrapping in Promise object.
    var promise = new Promise(function(resolve, reject) {
        resolve(getExampleData.bind(this)(label));
    }.bind(this));
    this.setOnValueCallback(promise);
}

function selectProject(projectId) {
    this.selectedProjectId = projectId;
    this.setOnKeysCallback(listFluxDataKeys.bind(this)(projectId));
}

function selectKey(keyId) {
    this.setOnValueCallback(getFluxValue.bind(this)(this.selectedProjectId, keyId));
    setUpNotification(this, this.selectedProjectId, keyId);
}

function updateKey(keyId, value, description, label) {
    var options = {};
    if (description) {
        options.description = description;
    }
    if (label) {
        options.label = label
    }
    if (value) {
        options.value = value;
    }
    return getDataTable(this.selectedProjectId).getCell(keyId).update(options);
}

function createKey(label, value, description) {
    var options = {};
    if (value) {
        options.value = value;
    }
    if (description) {
        option.description = description;
    }
    return getDataTable(this.selectedProjectId).createCell(label, options);
}

function listExampleData() {
    return this.exampleDataTable;
}

function getExampleData(label) {
    return this.exampleDataTable[label];
}

function listFluxProjects() {
    return new sdk.User(getFluxCredentials())
        .listProjects();
}

function listFluxDataKeys(projectId) {
    return getDataTable(projectId).listCells();
}

function getFluxValue(projectId, dataKeyId) {
    return getDataTable(projectId).fetchCell(dataKeyId);
}

function getDataTable(projectId) {
    if (!(projectId in dataTables)) {
      dataTables[projectId] = {
          dt: new sdk.Project(getFluxCredentials(), projectId).getDataTable(),
          websocketOpen: false
      }
    }
    return dataTables[projectId].dt;
}

function setUpNotification(dataSelector, projectId, keyId) {
    var dt = getDataTable(projectId);
    var options = {
        onOpen: function() {
            console.log('Websocket opened for '+ projectId + ' ' + keyId + '.');
            return;
        },
        onError: function() {
            console.log('Websocket error for '+ projectId + ' ' + keyId + '.');
            return;
        }
    };

    // Handler that calls the correct handlers for particular key ids, if set.
    function websocketRefHandler(msg) {
        if (msg.body.id in websocketCallbackHandlers) {
            websocketCallbackHandlers[msg.body.id](msg);
        } else {
            console.log('Received a notification, but key id is not matched by any callback handlers.');
        }
    }

    websocketCallbackHandlers[keyId] = function(msg) {
        console.log('Notification received.', msg);
        if (msg.body.id === keyId) {
            console.log('Calling setOnValueCallback on '+ projectId + ' ' + keyId + '.');
            if (dataSelector.setOnNotificationCallback) {
              dataSelector.setOnNotificationCallback(getFluxValue.bind(this)(projectId, keyId));
            } else {
              dataSelector.setOnValueCallback(getFluxValue.bind(this)(projectId, keyId));
            }
        }
    }

    if (!dataTables[projectId].websocketOpen) {
        dataTables[projectId].websocketOpen = true;
        dt.openWebSocket(options);
        dt.addWebSocketHandler(websocketRefHandler);
    }
}

function closeWebsocketConnections() {
    for (var project in dataTables) {
        dataTables[project].dt.closeWebSocket();
    }
    dataTables = {};
}

function getFluxCredentials() {
    return JSON.parse(localStorage.getItem('fluxCredentials'));
}

function setFluxCredentials(credentials) {
    localStorage.setItem('fluxCredentials', JSON.stringify(credentials));
}

function generateRandomToken() {
    var tokenLength = 24;
    var randomArray = [];
    var characterSet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = 0; i < tokenLength; i++) {
        randomArray.push(Math.floor(Math.random() * tokenLength));
    }
    return btoa(randomArray.join('')).slice(0, 48);
}

function getState() {
    var state = localStorage.getItem('state') || generateRandomToken();
    localStorage.setItem('state', state);
    return state;
}

function getNonce() {
    var nonce = localStorage.getItem('nonce') || generateRandomToken();
    localStorage.setItem('nonce', nonce);
    return nonce;
}

return DataSelector;

}());
