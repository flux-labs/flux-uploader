'use strict';
function convertObj(inObj) {
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
    return result;
}