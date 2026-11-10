import { chromium } from '@playwright/test'

const url = 'https://swaggyt00.github.io/bez-filtrov/'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({viewport:{width:420,height:900}})
const apiStatuses=[]
page.on('request',request=>{
  if(request.url().includes('/game/director'))console.log('AI REQUEST:',request.postData())
})
page.on('response',async response=>{
  if(response.url().includes('/game/director')){
    apiStatuses.push({status:response.status(),url:response.url()})
    if(!response.ok())console.log('AI ERROR RESPONSE:',await response.text().catch(()=>'?'))
  }
})
page.on('console',msg=>{
  if(msg.type()==='error')console.log('BROWSER CONSOLE:',msg.text())
})
page.on('pageerror',error=>console.log('PAGE ERROR:',error.message))

try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  const gender=page.locator('.gender-toggle')
  await gender.nth(0).getByRole('button',{name:'М',exact:true}).click()
  await gender.nth(1).getByRole('button',{name:'Ж',exact:true}).click()
  await page.locator('.scenario-card').filter({hasText:'После полуночи'}).click()
  await page.getByRole('button',{name:'Начать · После полуночи'}).click()

  let firstScenePlan=null
  let directorLiveConfirmed=0
  for (const risk of [1,2]){
    const startStatusCount=apiStatuses.length
    await page.getByRole('button',{name:'Риск '+risk}).click()
    await page.locator('.card-text').waitFor({state:'visible',timeout:12000})
    const text=await page.locator('.card-text').innerText()
    const status=await page.locator('.card-topline').innerText()
    const intro=await page.locator('.ai-intro').count()
      ?await page.locator('.ai-intro').first().textContent():null
    const chainLabel=await page.locator('.chain-caption strong').count()
      ?await page.locator('.chain-caption strong').first().textContent():null
    const responseStatuses=apiStatuses.slice(startStatusCount)
    const httpStatus=responseStatuses[0]?.status
    console.log('TURN:',JSON.stringify({risk,status,text,intro,chainLabel,httpStatus,apiStatuses}))
    if(responseStatuses.length!==1)throw new Error(
      'Expected exactly one AI Director request per turn: '+JSON.stringify(responseStatuses))
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
    if(saved?.renderedText!==text||saved?.currentRisk!==risk
      ||!status.includes('🔥'.repeat(risk))){
      throw new Error('Game rendered or saved an incorrect base card for risk '+risk)
    }

    const plan=saved?.director?.scenePlan
    if(httpStatus===200){
      directorLiveConfirmed++
      if(!saved?.aiWasUsed||(!intro?.includes('AI DIRECTOR')&&!chainLabel?.includes('AI CHAIN'))){
        throw new Error('Director returned 200 but client ignored the valid AI selection')
      }
      if(plan){
        const phases=['build','twist','payoff']
        if(!Array.isArray(plan.beats)||plan.beats.length!==3
          ||!plan.beats.every((beat,index)=>beat.phase===phases[index]
            && typeof beat.chain==='string'
            && ['truth','dare','either'].includes(beat.preferredType))){
          throw new Error('Malformed live story plan in saved game: '+JSON.stringify(plan))
        }
        if(!firstScenePlan)firstScenePlan=plan
      }else{
        console.warn('::warning::AI selected a valid card but no new story arc passed validation.')
      }
    }else if([429,502,503,504].includes(httpStatus)){
      if(saved?.aiWasUsed||intro){
        throw new Error('Failed Director request incorrectly claimed a new AI selection')
      }
      console.warn('::warning::AI Director HTTP '+httpStatus
        +'. Local card with exact selected risk verified; live AI on this turn not verified.')
      console.log('PARTIAL: original Director provider temporarily unavailable; safe fallback used.')
    }else{
      throw new Error('Unexpected AI Director HTTP '+httpStatus)
    }
    if(firstScenePlan && !plan){
      const outcome=(saved?.director?.chainHistory??[]).at(-1)
      if(outcome?.result!=='unavailable'){
        throw new Error('An active story disappeared without an ineligible-branch outcome')
      }
    }
    if(firstScenePlan && plan && JSON.stringify(plan)!==JSON.stringify(firstScenePlan)){
      const outcome=(saved?.director?.chainHistory??[]).at(-1)
      if(outcome?.result!=='unavailable'){
        throw new Error('Story arc silently changed before the first future beat')
      }
      firstScenePlan=plan
      console.log('CHAIN BRANCH: previous story became ineligible at this chosen risk.')
    }
    if(plan)console.log('STORY ARC:',JSON.stringify({
      risk,originTurn:plan.originTurn,
      sceneBeat:saved.director.turnsPlayed,beats:plan.beats,
    }))

    if(risk===1){
      await page.reload({waitUntil:'domcontentloaded'})
      await page.getByRole('button',{name:'Мне есть 18'}).click()
      await page.locator('button.resume-card').click()
      if((await page.locator('.card-text').innerText())!==text){
        throw new Error('Resume changed card text')
      }
      const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
      if(JSON.stringify(resumed?.director?.scenePlan??null)!==JSON.stringify(plan??null)){
        throw new Error('Resume changed or lost the story arc')
      }
      if(chainLabel){
        if((await page.locator('.chain-caption strong').first().textContent())!==chainLabel){
          throw new Error('Resume changed original AI Chain label')
        }
        if(!saved?.director?.chainSession)throw new Error('AI Chain caption without a stored Chain')
      }else if(intro?.includes('AI DIRECTOR')){
        if(!(await page.locator('.ai-intro').first().innerText()).includes(
          intro.replace('✦ ','').trim().slice(-20))){
          throw new Error('Resume lost valid AI intro')
        }
      }
    }
    await page.getByRole('button',{name:/Выполнено/}).click()
  }
  if(apiStatuses.length<2)throw new Error('Expected two actual Director requests')
  if(directorLiveConfirmed===0){
    console.warn('::warning::No live AI Director 200 observed in initial party turns. '
      +'Safe fallback verified, but live model selection remains unverified in this browser run.')
  }
  // Confirm the actual Sex flow uses AI without skipping Stage 0 just because
  // the player chooses three fires on the first turn.
  await page.getByRole('button',{name:'сброс'}).click()
  await page.locator('.scenario-card').filter({hasText:'Секс'}).click()
  await page.getByRole('button',{name:'Начать · Секс'}).click()
  await page.getByRole('button',{name:'Сохранить и передать'}).click()
  await page.getByRole('button',{name:/Я Игрок 2/}).click()
  await page.getByRole('button',{name:'Сохранить и начать'}).click()
  const sexResponseStart=apiStatuses.length
  await page.getByRole('button',{name:'Риск 3'}).click()
  await page.locator('.card-text').waitFor({state:'visible',timeout:12000})
  const sexText=await page.locator('.card-text').innerText()
  const sexStatus=await page.locator('.card-topline').innerText()
  const sexIntro=await page.locator('.ai-intro').count()
    ? await page.locator('.ai-intro').first().textContent() : null
  const sexChainLabel=await page.locator('.chain-caption strong').count()
    ? await page.locator('.chain-caption strong').first().textContent() : null
  const sexSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  console.log('SEX STAGE-0 RISK-3:',JSON.stringify({sexStatus,sexText,sexIntro,sexChainLabel,stage:sexSaved?.director?.sessionStage,apiStatuses}))
  const sexResponses=apiStatuses.slice(sexResponseStart)
  if(sexResponses.length!==1){
    throw new Error('Sex round expected exactly one real AI Director attempt: '+JSON.stringify(sexResponses))
  }
  const sexHttpStatus=sexResponses[0].status
  if(sexHttpStatus===200){
    if(!sexSaved?.aiWasUsed || (!sexIntro?.includes('AI DIRECTOR')&&!sexChainLabel?.includes('AI CHAIN'))){
      throw new Error('Sex AI returned 200 but the selected card was not marked as an AI result')
    }
  } else if([429,502,503,504].includes(sexHttpStatus)){
    // An upstream outage must not break a perfectly valid local challenge.
    // This is PARTIAL service verification, not proof that AI was available.
    if(sexSaved?.aiWasUsed || sexIntro || sexChainLabel
      || (sexSaved?.currentModifiers?.length??0)>0){
      throw new Error('Unavailable Sex AI incorrectly left an AI label/modifier on local fallback')
    }
    console.warn('::warning::Sex AI temporarily unavailable (HTTP '+sexHttpStatus
      +'). Local stage-0 risk-3 fallback verified; live Sex AI not verified on this attempt.')
    console.log('PARTIAL: live Sex AI unavailable; safe card displayed with exact chosen risk.')
  } else {
    throw new Error('Unexpected Sex AI HTTP '+sexHttpStatus)
  }
  if(!sexStatus.includes('🔥🔥🔥'))throw new Error('Sex risk 3 was mislabeled')
  if(sexSaved?.director?.sessionStage!==0)throw new Error('Sex stage jumped during risk selection')
  if(/(?:проникновени|кунилингус|минет|занимайтесь сексом)/i.test(sexText)){
    throw new Error('Sex stage 0 jumped straight to direct sex')
  }
  if(apiStatuses.slice(0,2).some(x=>![200,429,502,503,504].includes(x.status))){
    throw new Error('Unexpected party AI Director response: '+JSON.stringify(apiStatuses))
  }
  // Production test: AI WRITES a unique constraint and a separate AI judge
  // approves it. Rejection is valid behavior and must not insert canned text.
  const modifierStatuses=[]
  page.on('response',async response=>{
    if(response.url().includes('/game/modifier')){
      modifierStatuses.push({status:response.status()})
      if(!response.ok())console.log('CREATIVE AI REJECTED:',await response.text().catch(()=>'?'))
    }
  })
  let directorUnavailableStatus=null
  await page.route('**/game/director',async route=>{
    const request=route.request().postDataJSON()
    const performanceCardId='v09:afterdark-light-dare-015'
    if(!request.candidates.some((item)=>item.id===performanceCardId)){
      throw new Error('Known performance challenge is no longer in the allowed shortlist')
    }
    const response=await route.fetch()
    if([429,502,503,504].includes(response.status())){
      directorUnavailableStatus=response.status()
      await route.fulfill({response})
      return
    }
    if(!response.ok())throw Error('Unexpected live Director response: '+response.status())
    const body=await response.json()
    await route.fulfill({response,body:JSON.stringify({...body,selectedId:performanceCardId,addCondition:true})})
  })

  const bannedPresetNames=new Set(['ТОЛЬКО ОДИН ДУБЛЬ','БЕЗ ПАУЗ','ПЯТЬ СЕКУНД НА СТАРТ',
    'РУКИ НЕ ПОМОГАЮТ','НИ ОДНОГО СЛОВА','ВСЛЕПУЮ','ДВЕ КОНКРЕТНЫЕ ДЕТАЛИ'])
  let verified=false
  let upstreamLimited=false
  for(let attempt=1;attempt<=3;attempt++){
    await page.getByRole('button',{name:'сброс'}).click()
    await page.locator('.scenario-card').filter({hasText:'После полуночи'}).click()
    await page.getByRole('button',{name:'Начать · После полуночи'}).click()
    const startAt=modifierStatuses.length
    await page.getByRole('button',{name:'Риск 2'}).click()
    await page.locator('.card-text').waitFor({state:'visible',timeout:20000})
    const text=await page.locator('.card-text').innerText()
    const modifiers=await page.locator('.modifier-card').count()
    const status=modifierStatuses.slice(startAt).map(x=>x.status)
    console.log('LIVE ORIGINAL AI TRY:',JSON.stringify({
      attempt,text,status,
      label:modifiers?await page.locator('.modifier-card strong').first().innerText():null,
      description:modifiers?await page.locator('.modifier-card small').first().innerText():null,
    }))
    if(directorUnavailableStatus!==null){
      if(modifiers!==0)throw Error('Director '+directorUnavailableStatus+' incorrectly added a modifier')
      upstreamLimited=true
      console.warn('::warning::Director unavailable (HTTP '+directorUnavailableStatus
        +'). Base card/fallback verified; live modifier generation remains unverified.')
      console.log('PARTIAL: the original creative model could not run while Director was unavailable.')
      break
    }
    if(status.length!==1)throw Error('Expected one creative-model call, got '+JSON.stringify(status))
    if(status[0]===422){
      if(modifiers!==0)throw Error('Rejected AI text was replaced by an unwanted canned condition')
      continue
    }
    if(status[0]===429){
      if(modifiers!==0)throw Error('Provider 429 incorrectly produced a fallback modifier')
      console.warn('::warning::AI modifier rate-limited (429). Base game and safe no-modifier fallback passed, but live generation remains unverified.')
      upstreamLimited=true
      break
    }
    if([502,503,504].includes(status[0])){
      if(modifiers!==0)throw Error('Unavailable AI provider incorrectly produced a modifier')
      // Worker/provider outages are not app regressions. Respect the Worker
      // 8-second provider cooldown before a bounded retry on a new turn.
      if(attempt<3){
        console.log('RETRY: temporary creative AI HTTP '+status[0]+'; waiting for provider cooldown.')
        await page.waitForTimeout(8500)
        continue
      }
      console.warn('::warning::AI modifier unavailable (HTTP '+status[0]+' after 3 attempts). UI fallback verified; live generation remains unverified.')
      upstreamLimited=true
      break
    }
    if(status[0]!==200||modifiers!==1)throw Error('Creative AI did not produce a valid condition: '+JSON.stringify(status))
    const label=await page.locator('.modifier-card strong').first().innerText()
    const description=await page.locator('.modifier-card small').first().innerText()
    const caption=await page.locator('.modifier-card span').first().innerText()
    if(!caption.includes('AI-УСЛОВИЕ')||bannedPresetNames.has(label.toUpperCase())
      ||description.length<55||/после выполнения|вздохни|подними бров|подмигни/i.test(description)){
      throw Error('Not an original, meaningful condition: '+JSON.stringify({label,description}))
    }
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
    if(!stored?.currentModifiers?.[0]?.id?.startsWith('ai-original-')){
      throw Error('Client did not store independently verified original AI modifier')
    }
    await page.reload({waitUntil:'domcontentloaded'})
    await page.getByRole('button',{name:'Мне есть 18'}).click()
    await page.locator('button.resume-card').click()
    if((await page.locator('.card-text').innerText())!==text)throw Error('Resume changed base challenge')
    if((await page.locator('.modifier-card strong').first().innerText())!==label)throw Error('Resume lost original AI modifier')
    verified=true
    break
  }
  if(!verified && !upstreamLimited)throw Error('Three creative attempts were all rejected; no original modifier was observed.')
  if(verified)console.log('PASS: live original AI generation + independent review, no canned fallback, risk, CORS and save/resume.')

}catch(error){
  console.error('FAIL:',error)
  try{await page.screenshot({path:'live-ai-failure.png',fullPage:true})}catch{}
  process.exitCode=1
}finally{
  await browser.close()
}
