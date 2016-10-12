# flux-uploader
Flux SDK app that can upload to data keys and visualize geometry.

To run locally:
1. From command line in the flux-uploader folder, run npm install express
2. Run npm start
3. Edit index.js to prevent redirection to heroku instance. Comment out first three lines in app.get("*",...)
4. Same for index.html. Toggle comments on the two 'const REDIRECT_URL' lines.