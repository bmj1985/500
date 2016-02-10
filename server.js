'use strict';

let fs = require('fs');
let serve = require('duo-serve');
let babel = require('duo-babel');
let index = fs.readFileSync('./index.html', 'utf8');

serve(process.cwd())
  .title('500')
  .use(babel())
  .entry('node_modules/deck-of-cards/dist/deck.js')
  .entry('bower_components/async/dist/async.js')
  .entry('index.js')
  .entry('index.css')
  .html('index.html')
  .listen(4000);
