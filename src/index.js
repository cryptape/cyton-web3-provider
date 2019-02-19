const Web3 = require('web3')
const ProviderEngine = require('web3-provider-engine')
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js')
const FilterSubprovider = require('web3-provider-engine/subproviders/filters.js')
const Web3Subprovider = require("web3-provider-engine/subproviders/provider.js")
const CacheSubprovider = require('web3-provider-engine/subproviders/cache.js')
const SubscriptionsSubprovider = require('web3-provider-engine/subproviders/subscriptions.js')

const context = window || global

context.chrome = { webstore: true }
context.Web3 = Web3

let callbacks = {}
let hookedSubProvider
let globalSyncOptions = {}

const Neuron = {
  init (rpcUrl, options, syncOptions) { 
    const engine = new ProviderEngine()
    const web3 = new Web3(engine)
    context.web3 = web3
    globalSyncOptions = syncOptions

    engine.addProvider(new CacheSubprovider())
    engine.addProvider(new SubscriptionsSubprovider())
    engine.addProvider(new FilterSubprovider())
    engine.addProvider(hookedSubProvider = new HookedWalletSubprovider(options))
    engine.addProvider(new Web3Subprovider(new Web3.providers.HttpProvider(rpcUrl)))
    engine.on('error', err => console.error(err.stack))
    engine.isNeuron = true
    engine.start()

    return engine
  },
  addCallback (id, cb, isRPC) {
    cb.isRPC = isRPC
    callbacks[id] = cb
  },
  executeCallback (id, error, value) {
    console.log(`executing callback: \nid: ${id}\nvalue: ${value}\nerror: ${error}\n`)

    let callback = callbacks[id]

    if (callback.isRPC) {
        const response = {'id': id, jsonrpc: '2.0', result: value, error: {message: error} }

      if (error) {
        callback(response, null)
      } else {
        callback(null, response)
      }
    } else {
      callback(error, value)
    }
    delete callbacks[id]
  }
}

if (typeof context.Neuron === 'undefined') {
  context.Neuron = Neuron
}

ProviderEngine.prototype.setHost = function (host) {
  var length = this._providers.length;
  this._providers[length - 1].provider.host = host;
}

ProviderEngine.prototype.sendRpc = function (payload) {
  var self = this;
  switch (payload.method) {

    case 'eth_accounts':
      var address = globalSyncOptions.address;
      return {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: address ? [address] : []
      };
    
    case 'eth_coinbase':
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: globalSyncOptions.address || null
    };
    
    case 'eth_uninstallFilter':
      self.sendAsync(payload, (error, rep) => {
        return {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: true
        };
      });

    case 'net_version':
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: globalSyncOptions.networkVersion || null
    };
    
    case 'net_listening':
      try {
        self._providers.filter(function (p) {
          return p.provider !== undefined;
        })[0].provider.send(payload);
        return {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: true
        };
      } catch (e) {
        return {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: false
        };
      };
      break;
    
    // throw not-supported Error
    default:
      var message = 'The Cyton Web3 object does not support synchronous methods like ' + payload.method + ' without a callback parameter.';
      throw new Error(message);
  }
};

ProviderEngine.prototype.isConnected = function () {
  return this.sendRpc({
    id: 9999999999,
    jsonrpc: '2.0',
    method: 'net_listening',
    params: []
  }).result;
};

module.exports = Neuron

