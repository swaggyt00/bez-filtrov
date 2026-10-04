import { afterdarkCards } from './catalog-afterdark'
import { coupleCards } from './catalog-couple'
import { partyCards } from './catalog-party'
import { sexCards } from './catalog-sex'

const textOverrides: Record<string, string> = {
  'party-hard-dare-029': 'Поцелуй {{other.acc}} в шею и сразу после скажи, поцеловал{{self.g:|а}} бы ты {{other.acc}} вне игры.',
  'afterdark-hard-dare-027': 'Встаньте перед зеркалом вплотную: {{other.nom}} впереди, ты сзади. Поцелуй {{other.acc}} в шею, глядя на отражение.',
}

export const cards = [
  ...coupleCards,
  ...sexCards,
  ...partyCards,
  ...afterdarkCards,
].map((card) => textOverrides[card.id] ? { ...card, text: textOverrides[card.id] } : card)
