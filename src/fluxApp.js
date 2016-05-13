'use strict';


function jsonToViewport(data) {
    if (data == null) {
        setStatus('Downloading key to render');
        fluxDt.get(getFluxKey().CellId).then(function (response) {
            jsonToViewportHelper(response.value);
            setStatus('Ready to render');
        });
    } else {
        jsonToViewportHelper(data);
    }
}

function jsonToViewportHelper(data) {
    fluxViewport.setGeometryEntity(data).then(function () {
        fluxViewport.focus();
    });
}

var fluxUser = null;
var fluxProjects = null;
var fluxCells = null;
var fluxDt = null;

function populateProjectList() {
    setStatus('Loading projects');
    populateSelector(projectSelector, getFluxProjectList());
    return populateKeyList();
}

function getFluxProject() {
    var projectIndex = parseInt(projectSelector.value);
    var projectInfo = fluxProjects[projectIndex];
    var project = fluxUser.getProject(projectInfo);
    return project;
}

function getFluxKey() {
    var keyIndex = parseInt(keySelector.value);
    return fluxCells[keyIndex];
}

function populateKeyList() {
    setStatus('Loading keys');
    fluxDt = getFluxProject().getDatatable();
    return fluxDt.cells().then(function(cells) {
        fluxCells = cells.cellIds;
        populateSelector(keySelector, getFluxKeyList());
    });
}

function populateSelector(selector, items) {
    while(selector.children.length > 0) {
        selector.removeChild(selector.children[0]);
    }
    for (var i=0;i<items.length;i++) {
        var item = items[i];
        var opt = document.createElement('option');
        opt.appendChild(document.createTextNode(item));
        opt.value = i;
        selector.appendChild(opt);
    }
    setStatus('Ready');
}

function handleFileChanged() {
    if (inputFile.files.length === 0) {
        return;
    }
    var selectedFile = inputFile.files[0];
    var reader = new FileReader();
    reader.onloadend = handleFileRead;
    reader.readAsText(selectedFile);
}

function handleFileRead(e) {
    // Check if we need to convert
    var filename = inputFile.files[0].name.split('.');
    var extension = filename[filename.length-1];
    var result = e.target.result;
    if (extension === 'obj') {
      result = convertObj(result);
    } else if (extension === 'stl') {
      result = convertStl(result);
    }
    uploadToFlux(result, getFluxProject(), getFluxKey());

    // Afte upload render in viewport
    jsonToViewportHelper(result);
}

function getFluxProjectList() {
    if (fluxProjects) {
        var names = [];
        for (var i=0;i<fluxProjects.length;i++) {
            names.push(fluxProjects[i].name);
        }
        return names;
    } else {
        return [];
    }
}

function getFluxKeyList() {
    if (fluxCells) {
        var names = [];
        for (var i=0;i<fluxCells.length;i++) {
            names.push(fluxCells[i].ClientMetadata.Label);
        }
        return names;
    } else {
        return [];
    }
}

var downloadUrl = null;
function downloadJson(jsonString) {
  if (downloadUrl) {
    window.URL.revokeObjectURL(downloadUrl);
  }
  var a = document.createElement('a');
  downloadUrl = window.URL.createObjectURL(new Blob([jsonString]), {type: 'text/json'});
  a.href = downloadUrl;
  a.download = (getFluxKey().ClientMetadata.Label)+'.json';
  a.click();
}

function uploadToFlux(content) {
    setStatus('Uploading key');
    var contentObj = content;
    try {
        contentObj = JSON.parse(content);
    } catch (err) {
        if (err.constructor !== SyntaxError) {
            throw err;
        }
        // Syntax errors parsing json are ignored, then we assume it's not JSON
    }
    fluxDt.set(getFluxKey().CellId, contentObj).then(function () {
        setStatus('Done uploading key');
    });
}

function downloadFromFlux() {
    setStatus('Downloading key');
    fluxDt.get(getFluxKey().CellId).then(function (response) {
        downloadJson(JSON.stringify(response.value, null, 1));
        setStatus('Done downloading key');
    });
}

function loginToFlux() {
    setStatus('Logging in');
    var sdk = new Flux(FLUX_CLIENT_KEY);

    // Log in to get a user
    return sdk.login().then(function(user) {
        // Display some user information.
        console.log("Logged in: " + user.whoami.display_name+"(" + user.whoami.email+")");
        fluxUser = user;
        return user;
    }).then(function(user) {
        return user.listProjects();
    }).then(function (projects) {
        fluxProjects = projects.sort(function compare(a, b) {
            var parm = 'last_updated';//'created_at';
            if ( a[parm] === b[parm] ) return 0;
            return a[parm] < b[parm] ? 1 : -1;
        });
        return populateProjectList();
    });
}

function setStatus(text) {
    statusSpan.textContent = text;
}

function getParasolidUrl(projectId) {
    var parasolidUrl = 'https://';
    if (window.location.toString().indexOf('localhost') === -1) {
        parasolidUrl += 'flux.io'
    } else {
        parasolidUrl += 'localhost:8443'
    }
    parasolidUrl += '/p/'+projectId;
    parasolidUrl += '/api/blockexec?block=flux-internal/parasolid/Parasolid';
    return parasolidUrl;
}
