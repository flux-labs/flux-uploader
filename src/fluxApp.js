'use strict';

function handleLoad() {
  setupModelViewer();
  setupTableViewer();
  $('.preview-loader').hide();
  $('.upload-loader').hide();
}

function setupModelViewer() {
  $('#modelViewerContainer').css('margin', '0 auto');
  $('#modelViewerContainer').css('width', $('.box-input')[0].clientWidth * 0.85);
  $('#modelViewerContainer').css('height', $('.box-input')[0].clientHeight * 0.85);

  fluxViewport = new FluxViewport(modelViewerContainer);
  fluxViewport.setupDefaultLighting();

  // TODO(waihon): Doesn't work.
  $('#modelViewerContainer').css('overflow', 'hidden');
  $('#modelViewerContainer').css('display', 'none');
}

function setupTableViewer() {
  $('#tableViewerContainer').css('margin', '0 auto');
  $('#tableViewerContainer').css('width', $('.box-input')[0].clientWidth * 0.85);
  $('#tableViewerContainer').css('height', $('.box-input')[0].clientHeight * 0.85);

  $('#tableViewerContainer').addClass('ui small teal compact table');

  $('#tableViewerContainer').css('overflow', 'hidden');
  $('#tableViewerContainer').css('display', 'none');
}

function handleFileSelect() {
  if (inputFile.files.length === 0) {
    return;
  }

  selectedFile = inputFile.files[0];
  handleFileChange();
}

function handleFileChange() {
  disableUpload();
  disableViewContainers();
  enablePreviewLoading();
  parsedDataPayload = null;
  var reader = new FileReader();
  reader.onloadend = handleFileRead;
  reader.readAsText(selectedFile);
}

function handleFileRead(e) {
  var filename = selectedFile.name.split('.');
  var extension = filename[filename.length-1];
  var result = e.target.result;

  var completeResult = function(result) {
    parsedDataPayload = result;
    checkReadyToUpload();
    disablePreviewLoading();
  }

  if (extension === 'obj') {
    convertObj(result)
    .then(jsonToViewportHelper)
    .then(completeResult);
  } else if (extension === 'stl') {
    convertStl(result)
    .then(jsonToViewportHelper)
    .then(completeResult);
  } else if (extension === 'csv') {
    convertCsv(result)
    .then(jsonToTableHelper)
    .then(completeResult);
  } else {
    completeResult();
  }
}

function initialView() {
  $('.flux-view-form').hide();
  $('.flux-view-logout').hide();
  $('.initial-view-login').show();
  $('.login-flux').click(function() {
    fluxDataSelector.login();
  });
}

function fluxView() {
  $('.initial-view-login').hide();
  $('.flux-view-form').show();
  $('.flux-view-logout').show();
  $('.logout-flux').click(function() {
    fluxDataSelector.logout();
  });

  $('.upload-flux').click(function() {
    if (previewLoading || uploadLoading) {
      return;
    }
    uploadToFlux();
  });

  fluxDataSelector.showProjects();
}

function populateProjects(projectsPromise) {
  $('.projects-selection-dropdown').addClass('disabled loading');
  $('.projects-selection-dropdown > div.menu *').remove();
  projectsPromise
    .then(function(projects) {
      projects.entities.map(function(item) {
        $('.projects-selection-dropdown > div.menu')
          .append('<div class="item" data-value='+item.id+'>'+item.name+'</div>');
      });
      $('.projects-selection-dropdown').removeClass('disabled loading');
      $('.projects-selection-dropdown').dropdown({
        action: 'activate',
        onChange: function(value, text, $selectedItem) {
          fluxDataSelector.selectProject(value);
        }
      });
    });
}

function populateKeys(keysPromise) {
  $('.data-keys-selection-dropdown').addClass('disabled loading');
  $('.data-keys-selection-dropdown > div.menu *').remove();
  keysPromise
    .then(function(keys) {
      keys.entities.map(function(item) {
        $('.data-keys-selection-dropdown > div.menu')
          .append('<div class="item" data-value='+item.id+'>'+item.label+'</div>');
      });
      $('.data-keys-selection-dropdown').removeClass('disabled loading');
      $('.data-keys-selection-dropdown').dropdown({
        allowAdditions: true,
        message: {
          addResult: 'Add New Data Key - <b>{term}</b>',
        },
        action: 'activate',
        onChange: function(value, text, $selectedItem) {
          disableUpload();
          if (!$($selectedItem).hasClass('addition')) {
            fluxDataSelector.selectKey(value);
          }
          selectedUploadDestination = true;
          checkReadyToUpload();
        }
      });
    });
}

function onValueChange(valuePromise) {
  valuePromise
    .then(function(value) {
      console.log('Retrieved Value: ' + value);
    });
}

function jsonToViewportHelper(jsonData) {
  return fluxViewport.setGeometryEntity(jsonData).then(function () {
    $('#modelViewerContainer').show();
    fluxViewport.focus();

    return jsonData;
  });
}

function jsonToTableHelper(jsonData) {
  // Function to create a table as a child of el.
  // data must be an array of arrays (outer array is rows).
  function tableCreate(el, data) {
      el.innerHTML = '';
      var tbl  = document.createElement('table');

      for (var i = 0; i < Math.min(15, data.length); ++i)
      {
          var tr = tbl.insertRow();
          for(var j = 0; j < Math.min(15, data[i].length); ++j)
          {
              var td = tr.insertCell();
              td.appendChild(document.createTextNode(data[i][j].toString()));
          }
      }
      el.appendChild(tbl);
  }
  tableCreate($('#tableViewerContainer')[0], jsonData);
  $('#tableViewerContainer').show();

  return jsonData;
}

function disableViewContainers() {
  $('#modelViewerContainer').hide();
  $('#tableViewerContainer').hide();
}

function disableUpload() {
  $('.upload-flux').addClass('disabled');
}

function enablePreviewLoading() {
  previewLoading = true;
  $('.box-file').prop('disabled', true);
  $('.preview-loader').show();
}

function disablePreviewLoading() {
  // Hack to circumvent the blocking algorithm.
  setTimeout(function(){
    previewLoading = false;
    $('.box-file').prop('disabled', false);
    $('.preview-loader').hide();
  }, 0);
}

function enableUploadLoading() {
  uploadLoading = true;
  $('.projects-selection-dropdown').addClass('disabled');
  $('.data-keys-selection-dropdown').addClass('disabled');
  $('.upload-flux').addClass('disabled loading');
  $('.box-file').prop('disabled', true);
  $('.upload-loader').show();
}

function disableUploadLoading() {
  // Hack to circumvent the blocking algorithm.
  setTimeout(function(){
    uploadLoading = false;
    $('.upload-flux').removeClass('disabled loading');
    $('.projects-selection-dropdown').removeClass('disabled');
    $('.data-keys-selection-dropdown').removeClass('disabled');
    $('.box-file').prop('disabled', false);
    $('.upload-loader').hide();
  }, 0);
}

function checkReadyToUpload() {
  if (parsedDataPayload && selectedUploadDestination) {
    $('.upload-flux').removeClass('disabled');
  }
}

function reselectNewDataKey(key) {
  fluxDataSelector.selectProject($('.projects-selection-dropdown').dropdown('get value'));
  $('.data-keys-selection-dropdown').dropdown('set selected', key.id);
}

function uploadToFlux() {
  enableUploadLoading();

  if ($($('.data-keys-selection-dropdown').dropdown('get item')[0]).hasClass('addition')) {
    fluxDataSelector.createKey($('.data-keys-selection-dropdown').dropdown('get value'), parsedDataPayload)
      .then(function(key) {
        reselectNewDataKey(key);
        disableUploadLoading();
      });
  } else {
    fluxDataSelector.updateKey($('.data-keys-selection-dropdown').dropdown('get value'), parsedDataPayload)
      .then(function(done) {
        setTimeout(function() {
          disableUploadLoading();
        }, 500);
      });
  }
}
