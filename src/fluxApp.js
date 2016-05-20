'use strict';

function handleLoad() {
  setupModelViewer();
  setupTableViewer();
  $('.preview-loader').hide();
  $('.upload-loader').hide();
}

function setupModelViewer() {
  $('#modelViewerContainer').css('margin', '0 auto');
  $('#modelViewerContainer').css('width', $('.box-input')[0].clientWidth * 0.9);
  $('#modelViewerContainer').css('height', $('.box-input')[0].clientHeight * 0.9);

  fluxViewport = new FluxViewport(modelViewerContainer);
  fluxViewport.setClearColor();
  fluxViewport.setupDefaultLighting();

  var viewTypes = FluxViewport.getViews();
  console.log(viewTypes);
  for (var viewName in viewTypes) {
    $('.view-type-dropdown > div.menu')
      .append('<div class="item" data-value='+viewTypes[viewName]+'>'+viewName+'</div>');
  }
  $('.view-type-dropdown').dropdown({
    action: 'activate',
    onChange: function(value, text, $selectedItem) {
      fluxViewport.setView(parseInt(value));
    }
  });
}

function setupTableViewer() {
  $('#tableViewerContainer').css('margin', '0 auto');
  $('#tableViewerContainer').css('width', $('.box-input')[0].clientWidth * 0.9);
  $('#tableViewerContainer').css('height', $('.box-input')[0].clientHeight * 0.9);

  $('#tableViewerContainer').addClass('ui small teal compact celled table');

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
  closeAllMessages();
  disableViewContainers();
  enablePreviewLoading();

  $('.initial-instruction').hide();
  $('.preview-instruction .filename').text(selectedFile.name);
  $('.preview-instruction').show();

  parsedDataPayload = null;
  var reader = new FileReader();
  reader.onloadend = handleFileRead;
  reader.readAsText(selectedFile);
}

function handleFileRead(e) {
  var filename = selectedFile.name.split('.');
  var extension = filename[filename.length-1].toLowerCase();
  var result = e.target.result;

  var completeResult = function(resData) {
    parsedDataPayload = resData.fluxData;
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
  } else if (extension === 'dxf') {
    convertDxf(result)
    .then(jsonToViewportHelper)
    .then(completeResult);
  } else if (extension === 'csv') {
    convertCsv(result)
    .then(jsonToTableHelper)
    .then(completeResult);
  } else {
    console.error('File Not Supported', 'The extension .' + extension + ' is not supported. Please try another file instead.');
    showErrorMessage('File Not Supported', 'The extension .' + extension + ' is not supported. Please try another file instead.');
    disablePreviewLoading();
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

function jsonToViewportHelper(resData) {
  return fluxViewport.setGeometryEntity(resData.fluxData).then(function () {
    $('#modelViewerContainer').show();
    fluxViewport.focus();

    return resData;
  });
}

function jsonToTableHelper(resData) {
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
  tableCreate($('#tableViewerContainer')[0], resData.fluxData);
  $('#tableViewerContainer').show();

  return resData;
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
        sendUploadMetrics();
        reselectNewDataKey(key);
        setTimeout(function() {
          showSuccessMessage('Upload Successful', 'Your data is now available in your project.');
          disableUploadLoading();
        }, 500);
      })
      .catch(function(error) {
        showErrorMessage('Upload Failed', 'Check your internet connection or try refreshing the page.');
        disableUploadLoading();
      });
  } else {
    fluxDataSelector.updateKey($('.data-keys-selection-dropdown').dropdown('get value'), parsedDataPayload)
      .then(function(done) {
        sendUploadMetrics();
        setTimeout(function() {
          showSuccessMessage('Upload Successful', 'Your data is now available in your project.');
          disableUploadLoading();
        }, 500);
      })
      .catch(function(error) {
        showErrorMessage('Upload Failed', 'Check your internet connection or try refreshing the page.');
        disableUploadLoading();
      });
  }
}

function showErrorMessage(header, text) {
  $('.error-message .header').text(header);
  $('.error-message p').text(text);
  $('.error-message').addClass('visible');
}

function showSuccessMessage(header, text) {
  $('.success-message .header').text(header);
  $('.success-message p').text(text);
  $('.success-message').addClass('visible');
}

function closeAllMessages() {
  $('.error-message').removeClass('visible');
  $('.success-message').removeClass('visible');
}

function sendUploadMetrics() {
  var filename = selectedFile.name.split('.');
  var ext = filename[filename.length-1].toLowerCase();
  ga('send', {
    hitType: 'event',
    eventCategory: 'File Extension and Size',
    eventAction: 'upload',
    eventLabel: ext,
    eventValue: selectedFile.size
  });

}
