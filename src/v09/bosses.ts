import type { BossFamily, BossLossReason, BossOutcome, BossPenalty, BossSession, DirectorState } from './types'
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
    ['callback-spotlight','voluntary-ballot','opening-echo','callback-witness','team-captain'],
    ['duel-remix','role-handoff','double-improv','alibi-exchange','reversal-duel'],
    ['ensemble-remix','group-reveal','final-chorus','group-verdict','finale-callback'],
  ],
  afterdark: [
    ['night-callback','voluntary-ballot','opening-echo','rumor-reversal','volunteer-spotlight'],
    ['double-improv','role-handoff','duel-remix','night-alibi','mask-swap'],
    ['ensemble-remix','group-reveal','final-chorus','midnight-verdict','last-reveal'],
  ],
  couple: [
    ['shared-memory','wish-echo','mutual-choice','secret-attraction','bold-invitation'],
    ['perspective-switch','paired-improv','surprise-reframe','flirt-role-swap','honest-or-playful'],
    ['shared-finale','future-choice','open-ending','shared-spark','shared-surprise'],
  ],
  sex: [
    ['resume-consented','shared-choice','slow-connection','stay-with-spark','gentle-checkin'],
    ['trade-initiative','change-pacing','keep-thread','mutual-rhythm','initiative-offer'],
    ['open-ending','together-decide','no-timer-finish','quiet-finale','choose-finish'],
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
    case 'callback-witness':return `${lead}: предложи добровольцу вспомнить без личных подробностей один из последних игровых моментов. Вы вдвоём придумайте для него неожиданный второй сезон.`
    case 'team-captain':return `${lead}: собери команду из двух желающих. За тридцать секунд совместно придумайте дерзкое, но вымышленное оправдание самой странной истории этого вечера.`
    case 'alibi-exchange':return `${lead} и доброволец по очереди придумывают алиби для вымышленного неловкого события. После двух реплик каждый поменяйтесь ролями обвинителя и защитника.`
    case 'reversal-duel':return `${lead} и желающий разыгрывают короткий спор, а на середине меняются позициями и обязаны защищать противоположную точку зрения.`
    case 'group-verdict':return 'Все желающие выбирают, какая из вымышленных версий событий вечера самая нелепая. Победитель даёт ей название, не раскрывая чужие секреты.'
    case 'finale-callback':return 'Вернитесь к мотиву одного из первых сыгранных заданий. Каждый желающий добавляет один новый поворот, а последний произносит завершающую фразу.'
    case 'rumor-reversal':return `${lead}: придумай явно вымышленный слух о себе как герое ночного фильма. Остальные желающие предлагают две неожиданно правдоподобные версии развязки.`
    case 'volunteer-spotlight':return `${lead}: предложи желающему на минуту стать твоим соперником в импровизированном ночном ток-шоу. Оба защищают противоположные точки зрения.`
    case 'night-alibi':return `${lead} и доброволец ведут короткий допрос о полностью выдуманной ночной авантюре. После двух вопросов меняйтесь ролями.`
    case 'mask-swap':return `${lead} и согласный игрок меняются вымышленными характерами на одну сцену: один изображает абсолютную уверенность, второй — необъяснимое смущение.`
    case 'midnight-verdict':return 'Каждый желающий предлагает название вымышленного скандального фильма про сегодняшний вечер. Группа выбирает самый неожиданный вариант.'
    case 'last-reveal':return 'Все желающие добавляют по одному факту к полностью выдуманной ночной истории. Последний участник должен одним предложением объяснить неожиданный поворот.'
    case 'secret-attraction':return 'По желанию каждый открывает одну черту партнёра, которая вызывает притяжение сильнее, чем он обычно признаёт. Никто не обязан обещать действий.'
    case 'bold-invitation':return 'Каждый при желании предлагает одну смелую идею для вечера на двоих. Найдите ту, которая интересна вам обоим, не назначая обязательств.'
    case 'flirt-role-swap':return 'Сыграйте короткую вымышленную встречу, где сначала один пытается заинтересовать другого, а потом поменяйтесь ролями. Прикосновения необязательны.'
    case 'honest-or-playful':return 'Каждый по желанию выбирает один поворот: сказать партнёру неожиданную правду о притяжении или придумать забавное романтическое признание от вымышленного героя.'
    case 'shared-spark':return 'Назовите по одной детали этого вечера, которую хотелось бы запомнить. Вместе выберите свою собственную финальную реплику.'
    case 'shared-surprise':return 'Придумайте совместно неожиданную, но необязательную идею следующего свидания и завершите историю общим названием.'
    case 'stay-with-spark':return 'Если обоим комфортно, оставайтесь в уже согласованной сцене без новых правил. Разговор с приложением на время можно закончить.'
    case 'gentle-checkin':return 'Не меняя уже согласованных действий, любой может тихо предложить сохранить текущую атмосферу, замедлиться или остановиться.'
    case 'mutual-rhythm':return 'Если обоим хочется, согласуйте удобный темп уже выбранной сцены. Не требуется добавлять практики, положения или условия.'
    case 'initiative-offer':return 'Если это желанно обоим, предложите друг другу вести уже согласованную сцену. Любой может сохранить прежнюю инициативу или остановиться.'
    case 'quiet-finale':return 'Игра больше ничего не требует: останьтесь в комфортной близости, сделайте паузу или завершите вечер — как решите вместе.'
    case 'choose-finish':return 'Финал открыт. Продолжайте уже согласованную сцену только пока этого хотят оба, или просто уберите телефон и побудьте рядом.'
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
  const index=state.turnsPlayed+intensity+state.chainDepth
  const roles:BossRole[]=state.scenario==='party'||state.scenario==='afterdark'
    ? ['last-actor','last-target','all'] : ['both','both','both']
  let offset=index
  let mechanics=options.map((choices,i)=>choices[(offset+i)%choices.length])
  if(prior?.mechanics.join('|')===mechanics.join('|')){
    offset+=1
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

/**
 * Boss stakes are announced before the first phase. Losses have an actual
 * mechanical cost: the challenger's next eligible round is locked to a
 * card type. Risk/fire, consent, and the right to stop stay untouched.
 */
export function bossPenaltyFor(state:DirectorState,boss:BossSession,challengerIndex:number):BossPenalty {
  const losses=state.bossScore?.[challengerIndex]?.losses??0
  const type=state.scenario==='party'?'dare'
    :state.scenario==='afterdark'?(losses%2===0?'dare':'truth')
    : 'truth'
  return {
    bossId:boss.id,playerIndex:challengerIndex,type,
    label:state.scenario==='sex'
      ? 'Штрафный ход: только «Правда». Никаких обязательных физических действий.'
      : `Штрафный ход: только «${type==='dare'?'Действие':'Правда'}». Риск выбираешь сам.`,
  }
}

export function settleBoss(
  state:DirectorState,boss:BossSession,outcome:BossOutcome,
  challengerIndex:number,reason:BossLossReason|null=null,
):DirectorState {
  if(!['won','lost'].includes(outcome)
    ||!Number.isInteger(challengerIndex)
    ||challengerIndex<0||challengerIndex>=state.players.length){
    return state
  }
  const previous=state.bossHistory??[]
  const mechanics=Array.isArray(boss.mechanics) && boss.mechanics.length===3
    ?boss.mechanics.filter(m=>typeof m==='string'&&m.length<35)
    :[]
  const penalty=outcome==='lost'?bossPenaltyFor(state,boss,challengerIndex):null
  const previousScore=state.bossScore?.[challengerIndex]??{wins:0,losses:0}
  const score={
    ...state.bossScore,
    [challengerIndex]: {
      wins:previousScore.wins+(outcome==='won'?1:0),
      losses:previousScore.losses+(outcome==='lost'?1:0),
    },
  }
  return {
    ...state,
    bossScore:score,
    pendingBossPenalty:penalty,
    lastBossTurn:state.turnsPlayed,
    bossHistory:[...previous,{
      turn:state.turnsPlayed,mechanics,outcome,challengerIndex,
      reason:outcome==='lost'?reason:null,
      penaltyType:penalty?.type??null,
    }].slice(-12),
    scenePlan:null,chainSession:null,chainDepth:0,
    tension:outcome==='won'?Math.max(8,state.tension-28):state.tension,
  }
}
