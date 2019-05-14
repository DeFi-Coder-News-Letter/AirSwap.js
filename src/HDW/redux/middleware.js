import _ from 'lodash'
import HDKey from 'hdkey'
import ehdkey from 'ethereumjs-wallet/hdkey'
import * as actions from './actions'
import { getAllBalancesForAddress } from '../../deltaBalances/redux/actions'
import { defaultHDWPaths } from '../static/constants'
// import { initLedger } from '../../wallet/redux/actions'

const addressMapping = {}

const increment = 3
let offset
let publicKey
let chainCode
let walletType
let path
let resolve
let reject

const getHWDAddresses = (store, start) => {
  const hdk = new HDKey()
  hdk.publicKey = new Buffer(publicKey, 'hex')
  hdk.chainCode = new Buffer(chainCode, 'hex')
  const accounts = []
  for (let i = start; i < start + increment; i++) {
    const derivedKey = hdk.derive(`m/${i}`)
    const address = ehdkey
      .fromExtendedKey(derivedKey.publicExtendedKey)
      .getWallet()
      .getAddress()
      .toString('hex')
    const aPath = `${path}/${i}`
    const aAddress = `0x${address}`
    accounts.push({
      path: aPath,
      address: aAddress,
      index: i,
    })
    addressMapping[aPath] = aAddress
    store.dispatch(getAllBalancesForAddress(aAddress))
  }
  store.dispatch({
    type: 'LOADED_HDW_ACCOUNTS',
    accounts,
  })
}

export default function HDWMiddleware(store) {
  // TODO: Delete after ledger is integrated on instant, this is convenient for testing
  // window.setTimeout(() => store.dispatch(initLedger(), 1000))
  return next => action => {
    switch (action.type) {
      case 'INITIALIZE_HDW':
        offset = 0
        walletType = action.walletType
        path = action.path || defaultHDWPaths[walletType]
        resolve = action.resolve
        reject = action.reject
        store.dispatch({
          type: 'GET_HDW_CHAIN_KEY',
          walletType,
          path,
          resolve: response => {
            publicKey = response.publicKey
            chainCode = response.chainCode
            getHWDAddresses(store, offset)
          },
          reject: err => {
            reject(err)
          },
        })
        break
      case 'NEXT_HDW_ACCOUNTS':
        offset += increment
        store.dispatch(actions.setHDWPageOffset(offset))
        getHWDAddresses(store, offset)

        break
      case 'PREV_HDW_ACCOUNTS':
        offset = Math.max(offset - increment, 0)
        store.dispatch(actions.setHDWPageOffset(offset))
        getHWDAddresses(store, offset)
        break
      case 'SET_HDW_SUBPATH':
        store.dispatch(actions.initializeHDW(walletType, action.path))
        break
      case 'CONFIRM_HDW_PATH':
        resolve({
          path: _.trimStart(action.path, 'm/'),
          address: addressMapping[action.path],
          walletType,
        })
        break
      case 'CANCEL_HDW_INITIALIZATION':
        reject('Wallet initialization cancelled.')
        break
      default:
    }
    return next(action)
  }
}