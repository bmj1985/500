'use strict';

let prefix = Deck.prefix
let transform = prefix('transform')
let translate = Deck.translate
let $container = document.getElementById('container')
let $dealer = document.getElementById('dealer-value');
let $turn = document.getElementById('turn-value');
let $bid = document.getElementById('bid-value');
let $bidding = document.getElementById('bidding');
let $bidList = document.getElementById('bid-listing-list');
let $selectTricks = document.getElementById('select-tricks');
let $selectSuit = document.getElementById('select-suit');

// Buttons
let $bidButton = document.getElementById('bidding-bid');
let $passButton = document.getElementById('bidding-pass');

const STATES = {
  NEW = 0,

};

const points = {
  'spades': { base: 40, interval: 20 },
  'clubs': { base: 80, interval: 40 },
  'diamonds': { base: 120, interval: 60 },
  'hearts': { base: 160, interval: 80 },
  'no_trump': { base: 200, interval: 100 }
};

const suits = [
  'spades',
  'hearts',
  'clubs',
  'diamonds',
  'joker'
];

function getFontSize() {
  return window.getComputedStyle(document.body).getPropertyValue('font-size').slice(0, -2)
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

class Game {
  constructor() {
    analytics.track('New Game');

    this.players = [];
    this.teams = [];
    this.deck = Deck();
    this.dealer = 0;
    this.turn = 0;
    this.highestBid = null;

    this.players.push(new Player(true, 0));
    this.players.push(new Player(false, 1));
    this.players.push(new Player(false, 2));
    this.players.push(new Player(false, 3));

    this.players[0].setTeammate(this.players[2]);
    this.players[1].setTeammate(this.players[3]);
    this.players[2].setTeammate(this.players[0]);
    this.players[3].setTeammate(this.players[1]);

    this.teams.push({
      points: 0,
      players: [0, 2]
    });

    analytics.track('Team 1', { players: [0, 2] });

    this.teams.push({
      points: 0,
      players: [1, 3]
    });

    analytics.track('Team 1', { players: [1, 3] });

    this.player = this.players[0];

    // Joker
    let joker = Deck.Card(53);
    joker.mount(this.deck.$el);
    this.deck.cards.push(joker);
    this.deck.cards = this.deck.cards.filter(function(card, i) {
      card.setSide('back');
      // card.enableDragging();

      if (i % 13 === 2 || i % 13 === 1) {
        card.unmount();
        return false;
      }

      return true;
    });

    this.round = new Round(this);
  }

  ready() {
    analytics.track('Bidding Round');

    if (this.turn === 0) {
      $turn.innerHTML = 'You!';
    } else {
      if (this.turn === this.player.teammate.position) {
        $turn.innerHTML = 'Your Teammate!';
      } else {
        $turn.innerHTML = 'Player ' + (this.turn + 1);
      }
    }

    let biddingOrder = [];
    let biddingFns = [];

    for (let i = this.dealer; i < this.players.length; i++) {
      biddingOrder.push(this.players[i]);
    }

    for (let i = 0; i < this.players.length - biddingOrder.length; i++) {
      if (i === this.dealer && biddingOrder.length === 3) {
        biddingOrder.push(this.players[this.dealer]);
      } else {
        biddingOrder.push(this.players[i]);
      }
    }

    analytics.track('Bidding Order');

    let previousBid = null;

    biddingFns = biddingOrder.map(player => {
      return (function(player) {
        return done => {
          if (player.isHuman) {
            $bidButton.onclick = () => {
              // $bidList.innerHTML += `<li>Player ${bid.player.position + 1}: ${bid.tricks} ${bid.suit}</li>`;

              let suit = $selectSuit.options[$selectSuit.selectedIndex].value;
              let tricks = $selectTricks.options[$selectTricks.selectedIndex].value;

              done(null, {
                player: player,
                suit: suit.replace('_', ' '),
                tricks: tricks,
                points: 0
              });
            };

            $passButton.onclick = () => {
              analytics.track('Player passed', { isHuman: true });

              $bidList.innerHTML += `<li>You passed!`;
              done(null, {
                pass: true
              });
            };
          } else {
            let bid = player.bid();

            analytics.track('Player bid', {
              player: bid.player.position,
              tricks: bid.tricks,
              suit: bid.suit
            });

            if (!bid.pass) {
              $bidList.innerHTML += `<li>Player ${bid.player.position + 1}: ${bid.tricks} ${bid.suit}</li>`;
            } else {
              $bidList.innerHTML += `<li>Player ${bid.player.position + 1} passed!`;
            }

            setTimeout(function() {
              done(null, bid);
            }, 500);
          }
        };
      })(player);
    });

    for (let player of this.players) {
      player.ready();
    }

    async.series(biddingFns, (err, bids) => {
      bids = bids.filter(bid => !bid.pass)
      bids.sort((a, b) => a - b);

      const highestBid = bids.pop();
      this.highestBid = highestBid;

      if (highestBid.player.isHuman) {
        $bid.innerHTML = `You won with ${highestBid.tricks} ${highestBid.suit}`;
      } else {
        $bid.innerHTML = `Player ${highestBid.player.position} won with ${highestBid.tricks} ${highestBid.suit}`;
      }
      $bidding.classList.add('hidden');

      analytics.track('Player won bid');
    });
  }

  init() {
    this.deck.mount($container);
  }
}

class Round {
  constructor(game) {
    analytics.track('New round');

    this.game = game;
    this.chatte = [];
    shuffleArray(this.game.deck.cards);

    let dealer = 'Player ';
    if (this.game.dealer === 0) {
      dealer = 'You!';
    } else {
      dealer += this.game.dealer;
    }

    $dealer.innerHTML = dealer;

    // this.game.deck.shuffle(true);
    this.distribute();
  }

  distribute() {
    analytics.track('Distributing cards to players', {
      dealer: this.game.dealer
    });

    const batches = [3, 2, 3, 2];
    let cards = Object.create(this.game.deck.cards);

    batches.map((num, i) => {
      if (i <= 1) {
        const picked = cards.splice(cards.length - num, num);

        for (const card of picked) {
          this.chatte.push(card);
        }
      }

      // For each players
      for (let k = 0; k < 4; k++) {
        const picked = cards.splice(cards.length - num, num);
        this.game.players[k].pushCards(picked);
      }

    });

    this.game.dealer++;
    this.game.turn++;
    this.game.ready();
  }
}

class Player {
  constructor(human, pos) {
    this.isHuman = !!human;
    this.position = pos;
    this.teammate = null;
    this.cards = [];

    analytics.track('New player', {
      isHuman: this.isHuman,
      position: this.position,
      cards: this.cards
    });
  }

  pushCards(cards) {
    for (const card of cards) {
      this.cards.push(card);
    }
  }

  setTeammate(player) {
    // analytics.track('Player joined team', { player: this, teammate: player });

    this.teammate = player;
  }

  bid() {
    return {
      player: this,
      points: 0,
      suit: 'Hearts',
      tricks: 6
    };
  }

  serialize() {
    return {
      isHuman: this.isHuman,
      position: this.position,
      teammate: (this.teammate !== null) ? this.teammate.position : null,
      cards: this.cards
    };
  }

  ready() {
    this.cards.sort(function(a, b) {
      if (suits[a.suit] === 'joker') return 1;

      if (suits[a.suit] === suits[b.suit]) {
        return 1;
      } else {
        if (suits[a.suit] === 'hearts') {
          return 1;
        } else if (suits[b.suit] === 'hearts') {
          return -1;
        } else if (suits[a.suit] === 'diamonds') {
          return 1;
        } else if (suits[b.suit] === 'diamonds') {
          return -1;
        } else if (suits[a.suit] === 'clubs') {
          return 1;
        } else if (suits[b.suit] === 'clubs') {
          return -1;
        }

        return 0;
      }
    });

    this.cards.sort(function(a, b) {
      if (suits[a.suit] === 'joker') return 1;
      if (suits[b.suit] === 'joker') return -1;

      if (suits[a.suit] === suits[b.suit]) {
        const ranks = [1, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4];

        for (let rank of ranks) {
          if (a.rank === rank) return 1;
          if (b.rank === rank) return -1;
        }
      }

      return 0;
    });

    this.cards.reverse().map((card, i) => {
      if (this.isHuman) {
        card.setSide('front');

        card.animateTo({
          delay: i * 250,
          duration: 250,
          x: Math.round((i - 6.05) * 30 * getFontSize() / 16),
          y: Math.round(140 * getFontSize() / 16),
          rot: 0,

          onStart: function() {
            card.$el.style.zIndex = i;
          }
        });
      } else {
        let x = 0;
        switch (this.position) {
          case 0:
            x = -150;
          break;
          case 1:
            x = 100;
          break;
          case 2:
            x = 200;
          break;
          case 3:
            x = 300;
          break;
        }

        card.animateTo({
          delay: i * 250,
          duration: 250,
          x: Math.round((x -300) * getFontSize() / 16),
          y: Math.round(-120 * getFontSize() / 16),
          rot: 0,

          onStart: function() {
            card.$el.style.zIndex = i;
          }
        });
      }

      analytics.track('Sorting player cards', { player: this.serialize() });
    });
  }
}

new Game().init();
