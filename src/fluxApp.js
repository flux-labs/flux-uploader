'use strict';

function handleLoad() {
  $('#modelViewerContainer').css('margin', '0 auto');
  $('#modelViewerContainer').css('width', $('.box-input')[0].clientWidth * 0.85);
  $('#modelViewerContainer').css('height', $('.box-input')[0].clientHeight * 0.85);

  fluxViewport = new FluxViewport(modelViewerContainer);
  fluxViewport.setupDefaultLighting();
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
  //setUpBoxLoading();
  parsedDataPayload = null;
  var reader = new FileReader();
  reader.onloadend = handleFileRead;
  reader.readAsText(selectedFile);
}

function handleFileRead(e) {
  // Check if we need to convert
  var filename = selectedFile.name.split('.');
  var extension = filename[filename.length-1];
  var result = e.target.result;
  if (extension === 'obj') {
    result = convertObj(result);
  } else if (extension === 'stl') {
    result = convertStl(result);
  }

  jsonToViewportHelper(result)
  parsedDataPayload = result;
  checkReadyToUpload();
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

  $('.upload-flux').click(uploadToFlux);

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

function jsonToViewportHelper(data) {
  fluxViewport.setGeometryEntity(data).then(function () {
    fluxViewport.focus();
  });
}

function disableUpload() {
  $('.upload-flux').addClass('disabled');
}

function checkReadyToUpload() {
  if (parsedDataPayload && selectedUploadDestination) {
      console.log('Ready to Upload.');
    $('.upload-flux').removeClass('disabled');
  }
}

function uploadToFlux() {
  if ($($('.data-keys-selection-dropdown').dropdown('get item')[0]).hasClass('addition')) {
    fluxDataSelector.createKey($('.data-keys-selection-dropdown').dropdown('get value'), parsedDataPayload);
  } else {
    fluxDataSelector.updateKey($('.data-keys-selection-dropdown').dropdown('get value'), parsedDataPayload)
      .then(function(done) {
        console.info(done);
      });
  }
}
