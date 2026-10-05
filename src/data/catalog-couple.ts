import { coupleLightCards } from './v08/couple-light'
import { coupleHotCards } from './v08/couple-hot'
import { coupleHardCards } from './v08/couple-hard'

export const coupleCards = [
  ...coupleLightCards,
  ...coupleHotCards,
  ...coupleHardCards,
]
