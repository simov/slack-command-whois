
if (!process.argv[2]) {
  console.error('Specify /path/to/known.json')
  process.exit()
}

if (!process.argv[3]) {
  console.error('Specify /path/to/unknown.json')
  process.exit()
}

var fs = require('fs')
var path = require('path')

var fpath = {
  known: path.resolve(process.cwd(), process.argv[2]),
  unknown: path.resolve(process.cwd(), process.argv[3])
}
var config = {
  known: require(fpath.known),
  unknown: require(fpath.unknown)
}


;(() => {
  var data = ''
  process.stdin.on('data', (chunk) => {
    data += chunk
  })
  process.stdin.on('end', (chunk) => {
    try {
      var json = JSON.parse(data)
      job(json)
    }
    catch (err) {
      process.exit()
    }
  })
})()

function job (json) {
  var active = filter(config, json)

  if (active.unknown.length) {
    updateUnknown(config, active.unknown)
    fs.writeFileSync(
      fpath.unknown, JSON.stringify(config.unknown, null, 2), 'utf8')
  }

  if (active.known.length || active.unknown.length) {
    console.log(JSON.stringify({
      attachments: output.slack(active.known, active.unknown)
    }))
    console.log(JSON.stringify(
      output.online(active.known, active.unknown)
    ))
  }
  else {
    console.log(JSON.stringify({
      attachments: [{
        text: '_Няма никой_',
        mrkdwn_in: ['text']
      }]
    }))
    console.log(JSON.stringify([]))
  }
  console.log(JSON.stringify({
    attachments: output.slack(config.known, [])
  }))
  console.log(JSON.stringify({
    attachments: output.slack([], config.unknown)
  }))
}


var filter = (config, json) => {
  var known = {}
  var unknown = []

  json.active.forEach((active) => {
    var found = config.known
      .filter((user) => user.mac.indexOf(active.mac) !== -1)
      // better match (if needed)
      // .filter((user) => user.mac.some((mac) =>
      //   mac.replace(/[-:\s]/g, '').toLowerCase() ===
      //   active.mac.replace(/[-:\s]/g, '').toLowerCase()
      // ))

    if (found.length) {
      var user = found[0]
      known[user.id] = user
    }
    else {
      unknown.push(active)
    }
  })

  return {
    known: Object.keys(known).map((key) => known[key]),
    unknown
  }
}


var output = {
  slack: (known, unknown) => [
    {
      text: known
        .reduce((attachment, user) => (
          attachment +=
            (
              user.slack
              ? '<https://varnalab.slack.com/team/' +
                user.slack + '|@' + user.slack + '> '
              : ''
            ) +
            '_' + user.name + '_\n',
          attachment
        ), ''),
      mrkdwn_in: ['text']
    },
    {
      text: unknown
        .reduce((attachment, device) => (
          attachment += '_' + device.host + '_\n',
          attachment
        ), ''),
      mrkdwn_in: ['text']
    }
  ],
  online: (known, unknown) => ({
    known: known.map((user) => user.id),
    unknown: unknown.map((device) => ({host: device.host, mac: device.mac}))
  })
}


var updateUnknown = (config, unknown) => {
  unknown.forEach((active) => {
    var index = config.unknown
      .map((device) => device.mac)
      .indexOf(active.mac)

    if (index === -1) {
      config.unknown.push({mac: active.mac, host: active.host})
    }
    else {
      config.unknown[index].host = active.host
    }
  })

  sortUnknown(config)
}

var sortUnknown = (config) => {
  var phones = config.unknown
    .filter((user) => user.host && /android|i?phone/i.test(user.host))
    .sort((a, b) => (
      a.host.toLowerCase() > b.host.toLowerCase() ? 1 :
      a.host.toLowerCase() < b.host.toLowerCase() ? -1 : 0))

  var other = config.unknown
    .filter((user) => user.host && !/android|i?phone/i.test(user.host))
    .sort((a, b) => (
      a.host.toLowerCase() > b.host.toLowerCase() ? 1 :
      a.host.toLowerCase() < b.host.toLowerCase() ? -1 : 0))

  var nohost = config.unknown.filter((user) => !user.host)

  config.unknown = phones.concat(other).concat(nohost)
}
