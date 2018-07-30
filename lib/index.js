var AWS = require('aws-sdk');
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var _ = require('lodash');
var yaml = require('js-yaml');
var fs = require('fs');
var spawn = require('child_process').spawn;

AWS.config.accessKeyId = '';
AWS.config.secretAccessKey = '';

var defaultSettings = {
    aws: {
        region: 'us-west-2'
    },
    excludeServers: [],
    servers: {}
};

try {
    var settings = yaml.safeLoad(fs.readFileSync(__dirname + '/../settings.yaml', 'utf8'));
    _.defaultsDeep(defaultSettings, settings);
} catch (e) {
    throw e;
}

var colors = {
//    fg: '#fecd06',
//    bg: '#555555',
    fg: 'white',
    bg: 'blue',
    boldfg: 'cyan',
    boldbg: 'blue',
    fgAlt: 'white',
    bgAlt: 'black',
    boldfgAlt: 'white',
    boldbgAlt: 'black'
};

var config = {
    style: {
        fg: colors.fg,
        bg: colors.bg,
        border: {
            fg: colors.fg,
            bg: colors.bg 
        },
        hover: {
            fg: colors.fg,
            bg: colors.bg
        },
        focus: {
            fg: colors.fg,
            bg: colors.bg 
        },
        selected: {
            fg: colors.boldfg,
            bg: colors.boldbg,
            bold: true
        },
        scrollbar: {
            fg: colors.fg,
            bg: colors.bg
        },
        label: {
            fg: colors.boldfg,
            bg: colors.bg,
            bold: true
        }
    },
    styleAlt: {
        fg: 'white',
        bg: 'black',
        border: {
            fg: colors.fgAlt,
            bg: colors.bgAlt 
        },
        hover: {
            fg: colors.fgAlt,
            bg: colors.bgAlt
        },
        focus: {
            fg: colors.fgAlt,
            bg: colors.bgAlt 
        },
        selected: {
            fg: colors.boldfgAlt,
            bg: colors.boldbgAlt,
            bold: true
        },
        scrollbar: {
            fg: colors.fgAlt,
            bg: colors.bgAlt
        },
        label: {
            fg: colors.boldfgAlt,
            bg: colors.bgAlt,
            bold: true
        }
    }

};

var servers = {};

var screen = blessed.screen({
    smartCSR: true,
    style: config.style,
    autoPadding: true
});

var mainBox = blessed.box({
    parent: screen,
    label: {
        text: 'hackertool9000',
        side: 'right'
    },
    height: 'shrink',
    width: '100%',
    border: 'line',
    style: config.style,
    autoPadding: true
});

var loading = blessed.loading({
    parent: screen,
    style: config.style,
    height: '100%',
    width: '100%'
});

var bigtext = blessed.bigtext({
    parent: loading,
    content: 'hackertool9000',
    height: 'shrink',
    fch: ' ',
    ch: ' ',
    right: 0,
    bottom: 0,
    style: config.style
});

var bar = blessed.listbar({
    parent: mainBox,
    commands: {
        'one': {
            keys: ['a'],
            callback: function() {
                screen.render();
            }
        }
    },
    style: config.style,
    top:0
});

var list = blessed.list({
    parent: mainBox,
    label: 'EC2 Instances: ' + settings.aws.region,
    keys: true,
    width: '30%',
    tags: true,
    top: 0,
    bottom: 0,
    border: {
        type: 'line'
    },
    shadow: true,
    invertSelected: true,
    mouse: true,
    scrollStep: 1,
    style: config.styleAlt
});

list.key(['enter'], function(ch, key) {
    screen.realloc();
    screen.destroy();
    screen.setTerminal(process.env.TERM);
    var child = spawn('ssh', ['-o StrictHostKeyChecking=no','-tt', selectedHost], { stdio: 'inherit', detached: true, env: { TERM: process.env.TERM }});
    child.on('close', function () {
        process.exit(0);
    });
});


var details = blessed.form({
    parent: mainBox,
    top: 0,
    right: 1,
    left: '30%+2',
    shadow: true,
    border: {
        type: 'line'
    },
    style: config.style,
});

var notes = blessed.box({
    parent: details,
    top: 1,
    bottom: 0,
    right: 1,
    width: '100%-4',
    border: {
        type: 'line'
    },
    label: 'Info',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        ch: ''
    },
    style: config.styleAlt,
    keys: true,
    mouse: true
});

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

AWS.config.update({ region: settings.aws.region});

var ec2 = new AWS.EC2();

function getKey(array, key) {
    var val = array.filter(function (obj) {
       return obj.Key === key;
    });

    return val[0] ? val[0].Value : '';
}

var selectedHost;

function setDetails(name) {
    var server = servers[name] || {};
    var serverSettings = settings.servers[name] || {};
    selectedHost = server.instance.PrivateIpAddress;

    details.setLabel('(' + server.instance.InstanceId + ') ' + name);
    if (serverSettings.notes) {
        notes.content = serverSettings.notes;
    }
}

function selectServer(name) {
    setDetails(name);
    screen.render();
}

list.on('select item', function(el, selected) {
      if (list._.rendering) { 
          return;
      }

      selectServer(el.getText());
      screen.render();
});

screen.render();
loading.load('Loading server info...');
list._.rendering = true;

ec2.describeInstances(function(err, data) {
    if (err) {
        throw err;
    }

    data.Reservations.map(function (reservation) {
        reservation.Instances.map(function (instance) {
            var name = getKey(instance.Tags, 'Name');
            servers[name] = {
                name: name,
                instance: instance
            };
            // debug
            settings.servers[name] = { notes: JSON.stringify(instance, null, 2)};
        });
    });
   
    var names = _.pluck(_.sortBy(servers, 'name'), 'name');
    list.setItems(names);
    selectServer(names[0]);

    list._.rendering = false;
    loading.stop();
    screen.render();
    list.focus();
});
