'use strict';
function convertObj(inObj) {
  return new Promise(function(resolve, reject) {
    var result = {
      "vertices": [],
      "faces": [],
      "primitive": "mesh"
    };
    var comp;
    var lines = inObj.split('\n');
    for (var i=0;i<lines.length;i++) {
      var line = lines[i].trim();
      if ( line[0] === 'v' && line[1] === ' ') { // look for v not vt
        comp = line.trim().split(/ +/); // split by any number of spaces
        result.vertices.push([
          parseFloat(comp[1]),
          parseFloat(comp[3]),
          parseFloat(comp[2])
        ]);
      } else if (line[0] === 'f') {
        if (line[line.length-1] === '\\') {
          var fullLine = line.substr(0,line.length-1).trim();
          while(line[line.length-1] === '\\') {
            line = lines[i++].trim();
            fullLine += ' '+line.substring(1,line.length-1).trim();
          }
          line = fullLine;
          continue;
        }
        comp = line.trim().split(/ +/); // split by any number of spaces
        var face = [];
        for (var j=1;j<comp.length;j++) {
          var faceIndex = parseInt(comp[j].split('/')[0]);
          face.push(faceIndex-1);
        }
        result.faces.push(face);
      }
      if (result.faces.length > 400111) {
        // TODO This will crash flux renderer right now
        console.warn("Sorry, I hope to some day render more than 500K polygons.");
        break;
      }
    }
    console.log('Loaded',result.faces.length,'faces and',result.vertices.length,'vertices.');
    resolve({
      fluxData: result
    });
  });
}

function convertStl(inStl) {
  return new Promise(function(resolve, reject) {
    var result = {
      "vertices": [],
      "faces": [],
      "primitive": "mesh"
    };
    var comp;
    var chunks = inStl.split('endfacet');
    for (var i=0;i<chunks.length-1;i++) {
      var chunk = chunks[i];
      var lines = chunk.split('\n');
      var face = [];
      for (var l=0;l<lines.length;l++) {
        var line = lines[l];
        if ( line.indexOf('vertex') !== -1) {
          comp = line.trim().split(' ');
          face.push(result.vertices.length);
          result.vertices.push([
              parseFloat(comp[1]),
              parseFloat(comp[2]),
              parseFloat(comp[3])
          ]);
        }
      }
      result.faces.push(face);
    }

    // No result. Try binary approach instead.
    if (result.vertices.length < 1) {
      var fr = new FileReader();
      fr.onloadend = function(e) {
        // The stl binary is read into a DataView for processing
        var dv = new DataView(e.target.result, 80); // 80 == unused header
        var isLittleEndian = true;

        // Read a 32 bit unsigned integer
        var triangles = dv.getUint32(0, isLittleEndian);

        var offset = 4;
        for (var i = 0; i < triangles; i++) {
          // Get the normal for this triangle by reading 3 32 but floats.
          // Ignore this, add offset by 12.
          offset += 12;

          // Get all 3 vertices for this triangle, each represented
          // by 3 32 bit floats.
          for (var j = 0; j < 3; j++) {
            result.vertices.push([
              dv.getFloat32(offset, isLittleEndian),
              dv.getFloat32(offset+4, isLittleEndian),
              dv.getFloat32(offset+8, isLittleEndian)
            ]);
            offset += 12
          }

          // there's also a Uint16 "attribute byte count" that we
          // don't need, it should always be zero.
          offset += 2;

          // Create a new face for from the vertices and the normal
          result.faces.push([i*3, i*3+1, i*3+2]);
        }
        resolve({
          fluxData: result
        });
      }
      fr.readAsArrayBuffer(selectedFile);

    } else {
      resolve({
        fluxData: result
      });
    }

  });
}

function convertDxf(inDxf) {
  return new Promise(function(resolve, reject) {
    var parsedDxf;
    var result = [];
    var parser = new DxfParser();

    // Synchronously parse the Dxf file using DxfParser to return a parsed object.
    try {
      parsedDxf = parser.parseSync(inDxf);
    } catch(err) {
      return console.error(err.stack);
    }

    // Convert to Flux format.
    for (var i=0; i<parsedDxf.entities.length; i++) {
      var entity = parsedDxf.entities[i];

      if (entity.type === 'LINE') {
        result.push({
          primitive: 'line',
          start: [entity.vertices[0].x, entity.vertices[0].y, entity.vertices[0].z],
          end: [entity.vertices[1].x, entity.vertices[1].y, entity.vertices[1].z],
          attributes: {
            materialProperties: {
              color: binToRGB(entity.color)
            }
          },
        });
      } else if (entity.type === "POLYLINE") {
        result.push({
          primitive: 'polyline',
          points: entity.vertices.map(function(vert) {
            return [vert.x, vert.y, vert.z];
          }),
          attributes: {
            materialProperties: {
              color: binToRGB(entity.color)
            }
          },
        });
      } else if (entity.type === "POINT") {
        result.push({
          primitive: 'point',
          point: [entity.position.x, entity.position.y, entity.position.z],
          attributes: {
            materialProperties: {
              color: binToRGB(entity.color)
            }
          },
        });
      } else if (entity.type === "TEXT") {
        result.push({
          primitive: 'text',
          origin: [entity.startPoint.x, entity.startPoint.y, entity.startPoint.z],
          text: entity.text,
          attributes: {
            materialProperties: {
              color: binToRGB(entity.color)
            }
          },
        });
      } else {
        console.info('cant parse entity of type ', entity.type, entity);
      }
    }
    resolve({
      fluxData: result
    });
  });
}

function convertCsv(inCsv) {
  return new Promise(function(resolve, reject) {
    Papa.parse(inCsv, {
        error: function(err, file, inputElem, reason) {
          // Executed if an error occurs while loading the file,
          // or if before callback aborted for some reason.
          reject(reason);
        },
        complete: function(results, file) {
          resolve({
            fluxData: results.data
          });
        }
      }
    );
  });
}

function convertJson(inJson) {
  return new Promise(function(resolve, reject) {
    try {
      let json = JSON.parse(inJson);
      resolve({
        fluxData: json
      });
    } catch (e) {
      reject(e.message);
    }
    
  });
}

// Convert bin to RGB values.
function binToRGB(bin) {
    var pbin = parseInt(bin,2);
    var r = pbin >> 16;
    var g = pbin >> 8 & 0xFF;
    var b = pbin & 0xFF;
    return [r,g,b];
}
