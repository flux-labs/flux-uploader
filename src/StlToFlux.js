'use strict';
function convertStl(inStl) {
    var result = {
        "vertices": [],
        "faces": [],
        "primitive": "mesh"
    };
    var comp;
    var chunks = inStl.split('endfacet');
    for (var i=1;i<chunks.length;i++) {
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
    return result;
}