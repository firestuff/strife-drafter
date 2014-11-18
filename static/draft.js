var HEROES = [
  'Ray',
  'Fetterstone',
  'Claudessa',
  'Caprice',
  'Lady Tinder',
  'Shank',
  'Vermillion',
  'Malady',
  'Bo',
  'Carter',
  'Ace',
  'Moxie',
  'Bastion',
  'Hale',
  'Minerva',
  'Rook',
  'Vex',
  'Trixie',
  'Blazer',
  'Harrower',
  'Gokong',
  'Jin She',
  'Nikolai',
];

var steps = [
  {
    'type': 'seating',
  },
  {
    'type': 'countdown',
    'seconds': 10,
  },
  {
    'type': 'ban',
    'side': 'glory',
    'seconds': 60,
    'slots': 1,
  },
  {
    'type': 'ban',
    'side': 'valor',
    'seconds': 60,
    'slots': 1,
  },
  {
    'type': 'pick',
    'side': 'glory',
    'seconds': 60,
    'slots': 1,
  },
  {
    'type': 'pick',
    'side': 'valor',
    'seconds': 60,
    'slots': 2,
  },
  {
    'type': 'pick',
    'side': 'glory',
    'seconds': 60,
    'slots': 2,
  },
  {
    'type': 'pick',
    'side': 'valor',
    'seconds': 60,
    'slots': 2,
  },
  {
    'type': 'pick',
    'side': 'glory',
    'seconds': 60,
    'slots': 2,
  },
  {
    'type': 'pick',
    'side': 'valor',
    'seconds': 60,
    'slots': 1,
  },
  {
    'type': 'end',
  }
];
var next_step = 0;
var client_last_step_time = 0;
var server_last_step_time = 0;

var cosmo, game_id;
var sides = {
  'global': {
    'bans': [
      'Gokong',
    ],
  },
  'glory': {
    'bans': [],
    'picks': [],
    'team_name': '???',
    'extra_seconds': 60,
  },
  'valor': {
    'bans': [],
    'picks': [],
    'team_name': '???',
    'extra_seconds': 60,
  },
};

var getTime = function() {
  return Math.floor(new Date().getTime() / 1000);
}

var setTeamName = function() {
  localStorage['strife-drafter:team_name'] = prompt(
   'Enter your team name, or Cancel to observe.') || '';
  return localStorage['strife-drafter:team_name'];
};

var onSideClick = function(sidename) {
  if (!localStorage['strife-drafter:team_name']) {
    while (confirm(
          'You must set a team name before participating in the draft.' +
          'Would you like to set a team name now?')) {
      if (setTeamName()) {
        break;
      };
    }
    if (!localStorage['strife-drafter:team_name']) {
      return;
    }
  }
  cosmo.sendMessage(game_id, {
    'type': 'sideclick',
    'side': sidename,
    'team_name': localStorage['strife-drafter:team_name'],
  });
};

var onHeroClick = function(heroname) {
  if (!everyoneSeated()) {
    alert('Everyone must be seated before picks & bans begin.');
    return;
  }
  cosmo.sendMessage(game_id, {
    'type': 'heroclick',
    'hero': heroname,
  });
};

var sideBySender = function(sender) {
  for (var side in sides) {
    if (sides[side].sender == sender) {
      return side;
    }
  }
  return null;
};

var everyoneSeated = function(sender) {
  for (var side in sides) {
    if (!sides[side].team_name) {
      continue;
    }
    if (!sides[side].sender) {
      return false;
    }
  }
  return true;
};

var setGameTitle = function() {
  var title = document.getElementById('game-title');
  var text = sides['glory'].team_name + ' vs. ' + sides['valor'].team_name;
  title.textContent = text;
};

var onMessage = function(msg) {
  var app_msg = msg.message;

  var sender_side = sideBySender(msg.sender);

  if (steps[next_step].seconds) {
    var server_seconds = msg.created - server_last_step_time;
    var allowed_seconds = steps[next_step].seconds;
    if (steps[next_step].side) {
      allowed_seconds += sides[steps[next_step].side].extra_seconds;
    }
    if (server_seconds > allowed_seconds) {
      // Server timestamps rule, and this message is too late.
      nextStep(msg);
    }
  }

  switch (app_msg.type) {
    case 'sideclick':
      if (!(app_msg.side in sides) || !sides[app_msg.side].team_name) {
        console.log('sideclick invalid side:', msg);
        return;
      }
      if (sides[app_msg.side].sender) {
        console.log('sideclick duplicate side:', msg);
        return;
      }
      if (sender_side) {
        console.log('sideclick multiple sides per sender:', msg);
        return;
      }
      sides[app_msg.side].sender = msg.sender;
      sides[app_msg.side].team_name = app_msg.team_name;
      setGameTitle();
      if (everyoneSeated()) {
        nextStep(msg);
      }
      break;

    case 'heroclick':
      if (!everyoneSeated()) {
        console.log('heroclick before everyone seated:', msg);
        return;
      }
      if (!sender_side) {
        console.log('heroclick from unknown source:', msg);
        return;
      }
      if (!steps[next_step]) {
        console.log('heroclick on invalid step:', msg);
        return;
      }
      if (steps[next_step].side != sender_side) {
        console.log('heroclick from wrong side:', msg);
        return;
      }
      if (HEROES.indexOf(app_msg.hero) == -1) {
        console.log('heroclick for unknown hero:', msg);
        return;
      }
      if (unavailableHeroes().indexOf(app_msg.hero) != -1) {
        console.log('heroclick for unavailable hero:', msg);
        return;
      }
      addHero(app_msg.hero);
      if (!steps[next_step].slots_remaining) {
        nextStep(msg);
      }
      break;

    case 'timeout':
      // Work already done above.
      break;

    default:
      console.log('Unknown message type:', app_msg);
      break;
  }
};

var addHero = function(hero_name) {
  var hero = buildHero(hero_name);
  var step = steps[next_step];
  var side = sides[step.side];
  if (step.type == 'ban') {
    side.bans.push(hero_name);
  } else if (step.type == 'pick') {
    side.picks.push(hero_name);
  }
  var container_index = step.slots - step.slots_remaining;
  step.containers[container_index].appendChild(hero);
  step.slots_remaining--;
  updateHeroes();
};

var nextStep = function(msg) {
  var old_step = steps[next_step];

  switch (old_step.type) {
    case 'seating':
      if (!sideBySender(cosmo.currentProfile())) {
        document.body.className = 'observer';
      }
      break;

    case 'countdown':
      server_last_step_time += old_step.seconds;
      client_last_step_time = getTime();
      document.getElementById('countdown').className = null;
      break;

    case 'pick':
    case 'ban':
      for (var i = 0; i < old_step.containers.length; i++) {
        var container = old_step.containers[i];
        container.className = container.className.split(' ')[0];
      }

      // Measure real time impact from server timestamps.
      var server_seconds = msg.created - server_last_step_time;
      server_seconds -= old_step.seconds;
      if (server_seconds > 0) {
        sides[old_step.side].extra_seconds -= server_seconds;
        if (sides[old_step.side].extra_seconds < 0) {
          sides[old_step.side].extra_seconds = 0;
          var random_value = msg.random_value;
          while (old_step.slots_remaining) {
            var available = availableHeroes();
            var hero = available[random_value % available.length];
            console.log('Random hero choice:', hero);
            addHero(hero);
            random_value >>>= 8;
          }
        }
      }
      updateTimers();
      break;
  }

  next_step++;
  var new_step = steps[next_step];

  switch (new_step.type) {
    case 'countdown':
      document.getElementById('countdown').className = 'active';
      break;

    case 'pick':
    case 'ban':
      new_step.slots_remaining = new_step.slots;
      for (var i = 0; i < new_step.containers.length; i++) {
        new_step.containers[i].className += ' next-step';
      }
      break;

    case 'end':
      document.getElementById('slide').className = 'active';
      break;
  }

  if (msg) {
    server_last_step_time = msg.created;
    client_last_step_time = getTime();
  }
};

var unavailableHeroes = function() {
  var ret = [];
  for (var side in sides) {
    ret.push.apply(ret, sides[side].bans);
    ret.push.apply(ret, sides[side].picks);
  }
  return ret;
};

var availableHeroes = function() {
  var unavailable = unavailableHeroes();
  var ret = [];
  for (var i = 0; i < HEROES.length; i++) {
    var hero = HEROES[i];
    if (unavailable.indexOf(hero) == -1) {
      ret.push(hero);
    }
  }
  return ret;
};

var updateHeroes = function() {
  var unavailable = unavailableHeroes();
  for (var i = 0; i < unavailable.length; i++) {
    var hero = unavailable[i];
    var container = document.getElementById('hero-' + hero);
    container.className = 'hero-overlay hero-unavailable';
  }
};

var updateTimers = function() {
  for (var side in sides) {
    if (!sides[side].team_name) {
      continue;
    }
    sides[side].extra_seconds_cont.textContent = sides[side].extra_seconds;
    for (var i = next_step; i < steps.length; i++) {
      var step = steps[i];
      if (step.side == side) {
        sides[step.side].step_seconds_cont.textContent = step.seconds;
        break;
      }
    }
  }
};

var populateSides = function() {
  for (var side in sides) {
    if (!sides[side].team_name) {
      continue;
    }
    sides[side].container = document.getElementById(side + '-cont');
    document.getElementById(side).addEventListener('click',
      onSideClick.bind(null, side));
    sides[side].extra_seconds_cont = document.getElementById(side + '-extra');
    sides[side].step_seconds_cont = document.getElementById(side + '-step');
  }

  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    switch (step.type) {
      case 'pick':
      case 'ban':
        step.containers = [];
        for (var j = 0; j < step.slots; j++) {
          var div = document.createElement('div');
          if (step.type == 'ban') {
            div.className = 'heroban-cont';
          } else if (step.type == 'pick') {
            div.className = 'hero-cont';
          }
          sides[step.side].container.appendChild(div);
          step.containers.push(div);
        }
        break;
    }
  }
};

var buildHero = function(hero) {
  var container = document.createElement('div');
  container.className = 'hero-overlay';

  var img = document.createElement('img');
  img.src = 'static/heroes/' + hero.toLowerCase().replace(' ', '') + '.png';
  img.className = 'hero-medium';

  var text = document.createElement('div');
  text.className = 'text-overlay';
  text.appendChild(document.createTextNode(hero));

  container.appendChild(img);
  container.appendChild(text);
  return container;
};

var tick = function() {
  var step = steps[next_step];

  if (!step.seconds) {
    // Not a lot for a timer to do.
    return;
  }

  var side = step.side;
  var client_allowed_seconds = steps[next_step].seconds;
  if (side) {
    client_allowed_seconds += sides[step.side].extra_seconds;
  }
  var client_actual_seconds = getTime() - client_last_step_time;

  var seconds_left = client_allowed_seconds - client_actual_seconds;
  if (seconds_left < 0) {
    cosmo.sendMessage(game_id, {
      'type': 'timeout',
    });
    return;
  }

  switch (step.type) {
    case 'countdown':
      document.getElementById('countdown').textContent = seconds_left;
      break;

    case 'pick':
    case 'ban':
      var step_seconds = step.seconds;
      var extra_seconds = sides[step.side].extra_seconds;
      step_seconds -= client_actual_seconds;
      if (step_seconds >= 0) {
        sides[side].step_seconds_cont.textContent = step_seconds;
      } else {
        extra_seconds += step_seconds;
        sides[side].extra_seconds_cont.textContent = extra_seconds;
      }
      break;
  }
};

document.addEventListener('DOMContentLoaded', function() {
  // Instantiate cosmo instance.
  var callbacks = {
    'onMessage': onMessage,
  };
  cosmo = new Cosmopolite(callbacks, null, 'strife-drafter');

  // Determine or generate game ID
  if (!window.location.hash) {
    var binary_id = [];
    for (var i = 0; i < 9; i++) {
      binary_id.push(String.fromCharCode(Math.random() * 256));
    }
    window.location.hash =
      btoa(binary_id.join('')).replace('+', '-').replace('/', '_');
  }

  game_id = window.location.hash.slice(1);

  window.addEventListener('hashchange', function() {
    window.location.reload();
  });

  // Prompt for team name if necessary.
  if (localStorage['strife-drafter:team_name'] == undefined) {
    setTeamName();
  }

  // Start pulling event stream.
  cosmo.subscribe(game_id, -1);

  // Add hero objects and callbacks.
  var heroes_container = document.getElementById('heroes');

  for (var i = 0; i < HEROES.length; i++) {
    var hero = HEROES[i];
    var container = buildHero(hero);
    container.id = 'hero-' + hero;
    container.addEventListener('click', onHeroClick.bind(null, hero));
    heroes_container.appendChild(container);
  }

  updateHeroes();
  populateSides();
  setGameTitle();
  updateTimers();
  setInterval(tick, 250);
});
