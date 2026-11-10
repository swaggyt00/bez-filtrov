import type { BossFamily, BossSession, DirectorState } from './types'
import type { Scenario } from '../types'

export type BossRole = 'all' | 'last-actor' | 'last-target' | 'chain-opener' | 'both'

export interface BossPhaseDraft {
  mechanic: string
  role: BossRole
  caption: string
}
export interface BossDraft {
  title: string
  phases: BossPhaseDraft[]
}

// Each phrase below describes a real, permitted game mechanic; model output
// NEVER becomes a new unreviewed dare or sexual instruction.
export const bossMechanics: Record<Scenario, [string[],string[],string[]]> = {
  party: [
    ['callback-spotlight','voluntary-ballot','opening-echo'],
    ['duel-remix','role-handoff','double-improv'],
    ['ensemble-remix','group-reveal','final-chorus'],
  ],
  afterdark: [
    ['night-callback','voluntary-ballot','opening-echo'],
    ['double-improv','role-handoff','duel-remix'],
    ['ensemble-remix','group-reveal','final-chorus'],
  ],
  couple: [
    ['shared-memory','wish-echo','mutual-choice'],
    ['perspective-switch','paired-improv','surprise-reframe'],
    ['shared-finale','future-choice','open-ending'],
  ],
  sex: [
    ['resume-consented','shared-choice','slow-connection'],
    ['trade-initiative','change-pacing','keep-thread'],
    ['open-ending','together-decide','no-timer-finish'],
  ],
}

const prohibitions=/[{}<>\r\n\u0000-\u001f]|https?:|www\.|@|#|(?:обязан|застав|прикаж|накаж|наказ|сними\s+бель|занимайся\s+сексом|поцелуй|трах|минет|кунилинг|проникнов|не\s+можешь\s+отказ)/i
const commands=/^(?:сделай|скажи|назови|выбери|сними|потрогай|поцелуй|начни|выполни|попроси|подойди)(?=\s|[!,.?:]|$)/i
const clean=(value: unknown,min:number,max:number) =>
  typeof value==='string' && value===value.trim() && value.length>=min
  && value.length<=max && !prohibitions.test(value) && !commands.test(value) ? value : null

export function validateBossDraft(state:DirectorState,unknown:unknown):BossDraft|null {
  if(!unknown||typeof unknown!=='object')return null
  const proposed=unknown as {title?:unknown;phases?:unknown}
  const title=clean(proposed.title,6,58)
  if(!title||!Array.isArray(proposed.phases)||proposed.phases.length!==3)return null
  const mechanics=bossMechanics[state.scenario]
  const seen=new Set<string>()
  const phases:BossPhaseDraft[]=[]
  for(let i=0;i<3;i++){
    const item=proposed.phases[i]
    if(!item||typeof item!=='object')return null
    const beat=item as Record<string,unknown>
    if(typeof beat.mechanic!=='string'||!mechanics[i].includes(beat.mechanic)
      ||seen.has(beat.mechanic))return null
    if(state.scenario==='party'||state.scenario==='afterdark'){
      if(!['all','last-actor','last-target','chain-opener'].includes(String(beat.role)))return null
    }else if(beat.role!=='both')return null
    seen.add(beat.mechanic)
    // A model's flavor text is optional. Discard unsafe or imperative prose.
    phases.push({
      mechanic:beat.mechanic,
      role:beat.role as BossRole,
      caption:clean(beat.caption,12,110)??'',
    })
  }
  const history=state.bossHistory?.slice(-2)??[]
  if(history.some(previous=>previous.mechanics.join('|')===phases.map(x=>x.mechanic).join('|')))return null
  return {title,phases}
}

function activeRoleName(state:DirectorState,role:BossRole):string {
  const entries=state.history.filter(item=>!item.skipped)
  const last=entries.at(-1)
  const chainStart=entries.length>=4?entries.at(-4):entries[0]
  const index=role==='last-actor'?last?.playerIndex:
    role==='last-target'?last?.targetIndex:
    role==='chain-opener'?chainStart?.playerIndex:null
  if(typeof index!=='number'||index<0||index>=state.players.length)return 'любой желающий'
  return state.players[index].player.name
}

function contextualize(state:DirectorState,role:BossRole):string {
  if(role==='all')return 'Все желающие'
  if(role==='both')return 'Вы оба'
  return activeRoleName(state,role)
}

function gameAction(state:DirectorState,phase:BossPhaseDraft):string {
  const lead=contextualize(state,phase.role)
  const played=state.history.filter(entry=>!entry.skipped)
  const latest=played.at(-1)
  const pastType=latest?.type==='truth'?'откровенный вопрос':'испытание'
  switch(phase.mechanic){
    case 'callback-spotlight':return `${lead}: можно стать ведущим короткой импровизации. Остальные предлагают два безобидных варианта, ведущий выбирает один.`
    case 'night-callback':return `${lead}: верни в игру мотив последнего раунда — но изобрази его как драматичный трейлер. Можно передать роль добровольцу.`
    case 'voluntary-ballot':return 'Все желающие одновременно показывают, кто мог бы открыть финальный раунд. Выбранный участник вправе передать роль другому.'
    case 'opening-echo':return `${lead}: предыдущий ход был формата «${pastType}». Предложи его игровое, комедийное отражение без повторения личных ответов.`
    case 'duel-remix':return `${lead} и любой доброволец проводят дуэль импровизаций: две короткие версии одной нелепой ситуации. Остальные выбирают самую смешную.`
    case 'role-handoff':return `${lead}: передай роль ведущего другому желающему. Новый ведущий меняет жанр игры — комедия, детектив или фантастика — на один раунд.`
    case 'double-improv':return `${lead} и доброволец по очереди добавляют по одному неожиданному повороту к общей выдуманной истории. Не используйте чужих признаний.`
    case 'ensemble-remix':return 'Все желающие соединяют два мотива уже сыгранных ходов в одну короткую импровизацию. Не повторяйте дословно личные ответы.'
    case 'group-reveal':return 'Каждый желающий придумывает название для происходившего раунда. Группа выбирает одно название общим голосованием.'
    case 'final-chorus':return 'Каждый желающий добавляет по одной реплике к общему комедийному финалу. Последний участник завершает историю одной фразой.'
    case 'shared-memory':return 'Вспомните одно задание этой партии, которое вы оба решили выполнить. Каждый может сказать, что именно ему в нём запомнилось.'
    case 'wish-echo':return 'Каждый по желанию называет одну идею для совместного вечера. Найдите ту, которая интересна обоим.'
    case 'mutual-choice':return 'Вместе выберите атмосферу завершения: разговор, игра или спокойная близость. Никаких обязательных признаний.'
    case 'perspective-switch':return 'По желанию поменяйтесь ролями ведущего и слушателя: каждый коротко описывает одну игровую ситуацию со своей стороны.'
    case 'paired-improv':return 'Вдвоём разыграйте короткую вымышленную сцену в выбранном вами жанре. Любой из вас может остановить её.'
    case 'surprise-reframe':return 'Возьмите одну тему из сыгранных заданий и вместе найдите неожиданное, но приятное продолжение для обоих.'
    case 'shared-finale':return 'Закончите историю одним совместным решением: что вам хочется сохранить из этой игры для следующего вечера?'
    case 'future-choice':return 'Вместе придумайте одну необязательную идею на будущее. Она не становится обещанием или заданием.'
    case 'open-ending':return state.scenario==='sex'
      ? 'Вы оба решаете, что делать дальше: оставаться в уже согласованном действии, сделать паузу или закончить. Никакого обязательного финала.'
      : 'Закончите сцену так, как хочется обоим. Можно продолжить общение без приложения или вернуться к обычной игре.'
    case 'resume-consented':return 'Если вам обоим комфортно, оставайтесь в уже согласованной сцене. Не требуется менять практику, положение или темп.'
    case 'shared-choice':return 'Не прерывая атмосферу, каждый может предложить сохранить текущий ритм, замедлиться или остановиться. Выбирайте только взаимно желанный вариант.'
    case 'slow-connection':return 'Останьтесь в комфортной близости и действуйте только в рамках того, что уже выбрали вместе. При желании просто побудьте рядом.'
    case 'trade-initiative':return 'Если обоим хочется, мягко передайте инициативу другому, не добавляя новых действий или ограничений.'
    case 'change-pacing':return 'Если обоим подходит, немного измените темп уже согласованного действия. Любой может попросить вернуть прежний ритм или остановиться.'
    case 'keep-thread':return 'Продолжайте выбранную сцену без новых правил и таймера — только пока это комфортно обоим.'
    case 'together-decide':return 'Вместе решите, что приятнее сейчас: оставить всё как есть, замедлиться или остановиться. Любой вариант завершает эту фазу.'
    case 'no-timer-finish':return 'Никакого отсчёта и обязательной кульминации. Игра заканчивается, а вы сами выбираете, продолжать ли близость.'
    default:return 'Вместе выберите комфортный финал этой истории.'
  }
}

function familyFor(state:DirectorState):BossFamily {
  if(state.scenario==='party')return 'social'
  if(state.scenario==='afterdark')return 'chaos'
  if(state.scenario==='couple')return 'connection'
  const chain=state.chainFamily
  if(chain==='oral'||chain==='manual'||chain==='roleplay'||chain==='fetish'
    ||chain==='dom-sub'||chain==='edging'||chain==='control'||chain==='position'
    ||chain==='undress')return chain
  return state.sessionStage>=4?'sex':'tease'
}

function deterministicPlan(state:DirectorState):BossDraft {
  const options=bossMechanics[state.scenario]
  const prior=state.bossHistory?.at(-1)
  const played=state.history.filter(x=>!x.skipped)
  const intensity=played.slice(-4).reduce((sum,x)=>sum+x.risk,0)
  const index=(state.turnsPlayed+intensity+state.chainDepth)%3
  const roles:BossRole[]=state.scenario==='party'||state.scenario==='afterdark'
    ? ['last-actor','last-target','all'] : ['both','both','both']
  let offset=index
  let mechanics=options.map((choices,i)=>choices[(offset+i)%choices.length])
  if(prior?.mechanics.join('|')===mechanics.join('|')){
    offset=(offset+1)%3
    mechanics=options.map((choices,i)=>choices[(offset+i)%choices.length])
  }
  return {
    title:state.scenario==='sex'?'ВАША СЦЕНА'
      :state.scenario==='couple'?'НАШ ФИНАЛ':'ПОСЛЕДНИЙ ПОВОРОТ',
    phases:mechanics.map((mechanic,i)=>({
      mechanic,role:roles[i],caption:'',
    })),
  }
}

export function buildBossSession(state:DirectorState,proposed:unknown=null):BossSession {
  const valid=proposed?validateBossDraft(state,proposed):null
  const plan=valid??deterministicPlan(state)
  return {
    id:`${state.scenario}-boss-${state.turnsPlayed}`,
    family:familyFor(state),
    title:plan.title,
    phases:plan.phases.map(beat=>gameAction(state,beat)),
    phaseCaptions:plan.phases.map(beat=>beat.caption),
    mechanics:plan.phases.map(beat=>beat.mechanic),
    aiGenerated:Boolean(valid),
  }
}

export function settleBoss(state:DirectorState,boss:BossSession,skipped:boolean):DirectorState {
  const previous=state.bossHistory??[]
  const mechanics=Array.isArray(boss.mechanics) && boss.mechanics.length===3
    ?boss.mechanics.filter(m=>typeof m==='string'&&m.length<35)
    :[]
  return {
    ...state,
    lastBossTurn:state.turnsPlayed,
    bossHistory:[...previous,{turn:state.turnsPlayed,
      mechanics,outcome:skipped?'skipped' as const:'finished' as const}].slice(-6),
    scenePlan:null,chainSession:null,chainDepth:0,
    tension:skipped?state.tension:Math.max(8,state.tension-28),
  }
}
