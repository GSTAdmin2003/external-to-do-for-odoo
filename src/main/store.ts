// eslint-disable-next-line @typescript-eslint/no-require-imports
const Store = require('electron-store')

export type Settings = {
  odooUrl: string
  dbName: string
  username: string
  apiKey: string
  webhookPort: number
  webhookBindAll: boolean
}

const schema = {
  odooUrl:         { type: 'string', default: '' },
  dbName:          { type: 'string', default: '' },
  username:        { type: 'string', default: '' },
  apiKey:          { type: 'string', default: '' },
  webhookPort:     { type: 'number', default: 3001 },
  webhookBindAll:  { type: 'boolean', default: false }
}

export interface IStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  store: Settings
}

export function createStore(): IStore {
  return new Store({ name: 'settings', schema })
}
