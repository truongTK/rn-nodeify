#!/usr/bin/env node

// shelljs.exec('force-dedupe-git-modules')
const proc = require('child_process')
const fs = require('fs-extra')
const find = require('findit')
const path = require('path')
const MinimumViableMultisig = require('@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/MinimumViableMultisig.json')
const Proxy_json = require("@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/Proxy.json")

// var thisPkg = require('./package.json')

// function loadDeps() {
//   var pkgs = []
//   loadPkg('./package.json')

//   function loadPkg(pkgPath) {
//     var pkg = require(pkgPath)
//     for (var dep in pkg.dependencies) {
//       if (!allDeps[dep]) {
//         allDeps[dep] = true
//         pkgs.push.apply(pkgs, Object.keys(pkg.dependencies).map(function(name) {
//           return path.join(pkgPath, 'node_modules/' + name)
//         }))
//       }
//     }
//   }
// }

module.exports = function hackFiles (hacks) {
  const finder = find('./node_modules')
  hacks = hacks || hackers.map(h => h.name)

  finder.on('file', function (file) {
    if (!(/\.(js|json)$/).test(file) ||
      (/\/tests?\//).test(file)) {
      return
    }

    file = file.replace(/\\/g, path.posix.sep);

    const matchingHackers = hackers.filter(function (hacker) {
      return hacks.indexOf(hacker.name) !== -1 && hacker.regex.some(function (regex) {
        return regex.test(file)
      })
    })

    if (!matchingHackers.length) return

    file = path.resolve(file)
    fs.readFile(file, { encoding: 'utf8' }, onread)

    function onread (err, str) {
      if (err) throw err

      const hacked = matchingHackers.reduce(function (hacked, hacker) {
        return hacker.hack(file, hacked || str) || hacked
      }, str)

      if (hacked && hacked !== str) {
        console.log('hacking', file)
        fs.writeFile(file, hacked)
      }
    }
  })
}

// loadDeps(hackFiles)

var hackers = [
  // don't need this as soon as react native
  // stops ignoring webtorrent/package.json "browser": "./lib/fs-storage.js": false
  {
    name: 'ethers',
    regex: [
      /ethers\/utils\/web.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace('require("xmlhttprequest")', "XMLHttpRequest")
      return contents === fixed ? null : fixed
    }
  },
  {
    name: '@connext',
    regex: [
      /connext.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace('__importDefault(require("@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/MinimumViableMultisig.json"))', JSON.stringify(MinimumViableMultisig, null, '  '))
      fixed = fixed.replace('__importDefault(require("@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/Proxy.json"))', JSON.stringify(Proxy_json, null, '  '))
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'ts-nats',
    regex: [
      /tcptransport.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace('&& this.stream.isPaused()', '')
      fixed = fixed.replace('this.stream instanceof tls_1.TLSSocket', 'this.stream')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'react-native-tcp',
    regex: [
      /TcpSocket.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace('console.log.apply(console, args);', '')
      fixed = fixed.replace('var port = options.port || 0;', 'var port = options.port || 4222;')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'bluebird',
    regex: [
      /bluebird\/js\/main\/captured_trace\.js$/
    ],
    hack (file, contents) {
      const fixed = contents.replace(
        /fireGlobalEvent \= \(function\(\) \{\s{1}/,
        'fireGlobalEvent = (function() {var self = global;'
      )

      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'stream-browserify',
    regex: [
      /stream-browserify\/index\.js$/
    ],
    hack (file, contents) {
      const fixed = contents.replace(
        'module.exports = Stream;',
        'module.exports = global.StreamModule = Stream'
      )

      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'readable-stream',
    regex: [
      /readable-stream\/lib\/_stream_(readable|writable)\.js$/,
      /readable-stream\/readable\.js$/
    ],
    hack (file, contents) {
      const fixed = contents.replace(
        "var Stream = require('stream');",
        "var Stream = global.StreamModule || require('stream')"
      )

      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'has-cors',
    regex: [
      /has-cors\/index\.js/,
      /socket\.io\.js/,
      /engine\.io\.js/
    ],
    hack (file, contents) {
      const fixed = contents.replace("'withCredentials' in new XMLHttpRequest()", 'true')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'debug',
    regex: [
      /debug\/browser\.js/
    ],
    hack (file, contents) {
      const fixed = contents.replace("('WebkitAppearance' in document.documentElement.style)", 'true')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'rn-bundler',
    regex: [
      /react\-(?:native\/)?packager\/src\/bundler\/bundle\.js/i,
      /react\-(?:native\/)?packager\/src\/JSTransformer\/worker\/minify\.js/i,
    ],
    hack (file, contents) {
      if (contents.indexOf('mangle:false') !== -1) return

      const fixed = contents.replace(/(\s+)(fromString: true,)/, '$1$2$1mangle:false,')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'pseudomap',
    regex: [
      /pseudomap\/map\.js/
    ],
    hack (file, contents) {
      const bad = /(module\.exports\s+\=\s+Map[^r]+return[^}]+\})/
      const match = contents.match(bad)
      if (!match) return

      return contents.replace(match[0], 'module.exports=Map}else{') + '}'
    }
  },
  {
    name: 'fssync',
    regex: [
      /webtorrent\/lib\/fs-storage\.js/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const fixed = contents.replace(/fs\.existsSync\([^\)]*\)/g, 'false')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'rusha',
    regex: [
      /\/rusha\/rusha\.js/
    ],
    hack (file, contents) {
      const fixed = contents.replace(/typeof\ FileReaderSync \!\=\= \'undefined\'/, 'false')
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'bufferequal',
    regex: [/rudp\/lib\/bufferEqual\.js/],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const hacked = "module.exports = require('buffer-equal')"
      if (contents !== hacked) return hacked
    }
  },
  // {
  //   name: 'levelup',
  //   regex: [
  //     /levelup\/lib\/util\.js$/
  //   ],
  //   hack: function(file, contents) {
  //     var bad = 'require(\'../package.json\')'
  //     contents = contents.toString()
  //     if (contents.indexOf(bad) !== -1) {
  //       debugger
  //       var pkg = require(path.resolve(file, '../../package.json'))
  //       var fixed = contents.replace(bad, JSON.stringify(pkg))
  //       return contents === fixed ? null : fixed
  //     }
  //   }
  // },
  {
    name: 'webworkerthreads',
    regex: [
      /otr\/lib\/(dsa|otr)\.js/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace("require('webworker-threads').Worker", "null")
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'levelup',
    regex: [
      /levelup\/lib\/util\.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace("require('../package.json').devDependencies.leveldown", "'1.0.0'")
      fixed = fixed.replace("require('leveldown/package').version", "'1.0.0'")
      fixed = fixed.replace("require('leveldown/package.json').version", "'1.0.0'")
      fixed = fixed.replace("require('leveldown')", "null")

      // var bad = '\'leveldown'
      // var fixed = contents.replace(/\'leveldown/g, '\'asyncstorage-down')
      // bad = 'require(\'../package.json\')'
      // if (fixed.indexOf(bad) !== -1) {
      //   var pkg = require(path.resolve(file, '../../package.json'))
      //   fixed = fixed.replace(bad, JSON.stringify(pkg))
      // }

      // bad = "require('asyncstorage-down/package')"
      // if (fixed.indexOf(bad) !== -1) {
      //   console.log(path.dirname(file))
      //   console.log(resolve.sync('asyncstorage-down'), { basedir: path.dirname(file) })
      //   var pkg = require(path.resolve(file, '../../node_modules/asyncstorage-down/package.json'))
      //   fixed = fixed.replace(bad, JSON.stringify(pkg))
      // }

      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'non-browser',
    regex: [
      /level-jobs\/package\.json$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let pkg
      try {
        pkg = JSON.parse(contents)
      } catch (err) {
        console.log('failed to parse:', file)
        return
      }

      if (pkg.browser) {
        delete pkg.browser
        return prettify(pkg)
      }
    }
  },
  {
    name: 'simple-get',
    regex: [
      /simple\-get\/package\.json$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const pkg = JSON.parse(contents)
      if (pkg.browser['unzip-response'] === false) {
        delete pkg.browser['unzip-response']
        return prettify(pkg)
      }
    }
  },
  {
    name: 'browser_field',
    regex: [
      /package\.json$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let pkg
      try {
        pkg = JSON.parse(contents)
      } catch (err) {
        console.log('failed to parse:', file)
        return
      }

      if (pkg.browser && typeof pkg.browser === 'object') {
        let fixed
        for (const left in pkg.browser) {
          if (left[0] === '.' && !(/\.[a-z]{0,4}$/i).test(left)) {
            fixed = true
            pkg.browser[left + '.js'] = pkg.browser[left]
            delete pkg.browser[left]
          }
        }

        if (fixed) return prettify(pkg)
      }
    }
  },
  {
    name: 'webtorrentstuff',
    regex: [
      /\/torrent\-discovery\/package.json$/,
      /\/webtorrent\/package.json$/,
      /\/load-ip-set\/package.json$/,
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const pkg = JSON.parse(contents)
      const browser = pkg.browser
      let save
      const toDel = [
        'bittorrent-dht',
        'bittorrent-dht/client',
        'bittorrent-tracker',
        'bittorrent-tracker/client',
        'bittorrent-swarm'
      ]

      for (const p in browser) {
        if (browser[p] === false) {
          toDel.push(p)
        }
      }

      toDel.forEach(function (p) {
        if (p in browser) {
          delete browser[p]
          save = true
        }
      })

      if (save) return prettify(pkg)
    }
  },
  {
    name: 'depgraph (rn 0.6)',
    regex: [
      /react\-packager\/.*\/DependencyGraph\/index\.js/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const evil = 'var id = sansExtJs(name);'
      if (contents.indexOf(evil) !== -1) {
        return contents.replace(evil, 'var id = name;')
      }
    }
  },
  {
    name: 'ecurve',
    regex: [
      /ecurve\/lib\/names\.js/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const evil = 'var curves = require(\'./curves\')'
      if (contents.indexOf(evil) !== -1) {
        return contents.replace(evil, 'var curves = require(\'./curves.json\')')
      }
    }
  },
  {
    name: 'assert',
    regex: [
      /assert\/assert.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const evil = 'var util = require(\'util/\');'
      if (contents.indexOf(evil) !== -1) {
        return contents.replace(evil, 'var util = require(\'util\');')
      }
    }
  },
  // {
  //   name: 'net',
  //   regex: [
  //     /bittorrent-swarm\/package\.json$/,
  //     /portfinder\/package\.json$/
  //   ],
  //   hack: function (file, contents) {
  //     var pkg
  //     try {
  //       pkg = JSON.parse(contents)
  //     } catch (err) {
  //       console.log('failed to parse:', file)
  //       return
  //     }

  //     rewireMain(pkg)
  //     if (pkg.browser.net !== 'utp') {
  //       pkg.browser.net = 'utp'
  //       return prettify(pkg)
  //     }
  //   }
  // },
  {
    name: 'bytewise',
    regex: [
      /bytewise\/bytewise\.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      let fixed = contents
      fixed = fixed.replace("require('typewise')", "null")
      return contents === fixed ? null : fixed
    }
  },
  {
    name: 'unzip-response',
    regex: [
      /unzip\-response\/index\.js$/
    ],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const hack = ';res.headers = res.headers || {};'
      if (contents.indexOf(hack) !== -1) return

      const orig = "if (['gzip', 'deflate'].indexOf(res.headers['content-encoding']) !== -1) {"
      return contents.replace(
        orig,
        hack + orig
      )
    }
  },
  {
    name: 'rn-packager',
    regex: [
      /DependencyResolver\/Package\.js/
    ],
    hack (file, contents) {
      // var hack = body(function () {
      /*
        if (!browser[name]) return name

        // HACK!
        name = browser[name]
        if (name[0] === '.') {
          return '.' + name
        }

        return name
      */
      // })

      let fixed = contents
      // fixed = fixed.replace('return browser[name] || name', hack)
      // fixed = fixed.replace("this._cache.get(this.path, 'haste'", "this._cache.get(this.path, 'package-haste'")
      fixed = fixed.replace("this._cache.get(this.path, 'name'", "this._cache.get(this.path, 'package-name'")
      return fixed === contents ? null : fixed
    }
  },
  {
    name: 'crypto-browserify',
    regex: [
      /\/crypto-browserify\/rng\.js$/
    ],
    hack (file, contents) {
      // var hack = body(function () {

      //   // react-native-hack
      //   var _crypto = {
      //     randomBytes: function (size) {
      //       console.warn('WARNING: using insecure random number')
      //       return Math.random() * size
      //     }
      //   }

      // })

      const hack = body(function () {

         /*
         // react-native-hack
         try {
           var _crypto = (
             g.crypto || g.msCrypto || require('crypto')
           )
         } catch (err) {
           _crypto = {}
         }
         */
      })

      if (contents.indexOf('react-native-hack') !== -1) return

      return contents.replace(/_crypto\s+=\s+\(\s+g\.crypto\s+\|\|\s+g.msCrypto\s+\|\|\s+require\('crypto'\)\s+\)/, hack)
    }
  },
  {
    name: 'version',
    regex: [/pbkdf2/],
    hack (file, contents) {
      if (isInReactNative(file)) return

      const fixed = contents.replace('process.version', '"' + process.version + '"')

      return contents === fixed ? null : fixed
    }
  },
]

function rewireMain (pkg) {
  if (typeof pkg.browser === 'string') {
    const main = pkg.browser || './index.js'
    pkg.browser = {}
    pkg.browser[pkg.main] = main
  } else if (typeof pkg.browser === 'undefined') {
    pkg.browser = {}
  }
}

function rethrow (err) {
  if (err) throw err
}

function body (fn) {
  return fn.toString().split(/\n/)
.slice(2, -2)
.join('\n')
.trim()
}

function prettify (json) {
  return JSON.stringify(json, null, 2)
}

function isInReactNative (file) {
  return (/\/react\-native\//).test(file)
}
