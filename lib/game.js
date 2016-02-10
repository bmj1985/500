/** @jsx element */
'use strict';

import element from 'dekujs/virtual-element';
import {render, tree } from 'dekujs/deku';
import Player from './player';
import UI from './ui';

let app = tree(<UI />);
render(app, document.getElementById('ui'));

export default class Game {
  constructor() {

  }

  start() {}
}
