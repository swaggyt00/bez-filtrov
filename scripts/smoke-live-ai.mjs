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

  for (const risk of [1,2]){
    await page.getByRole('button',{name:'Риск '+risk}).click()
    await page.locator('.card-text').waitFor({state:'visible',timeout:12000})
    const text=await page.locator('.card-text').innerText()
    const status=await page.locator('.card-topline').innerText()
    const intro=await page.locator('.ai-intro').count() ? await page.locator('.ai-intro').first().textContent() : null
    console.log('TURN:',JSON.stringify({risk,status,text,intro,apiStatuses}))
    if(!intro?.includes('AI DIRECTOR')){
      throw new Error('AI Director did not supply a live intro; observed API '+JSON.stringify(apiStatuses))
    }
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
    if(!saved?.aiWasUsed||saved?.renderedText!==text)throw new Error('AI save mismatch')

    if(risk===1){
      await page.reload({waitUntil:'domcontentloaded'})
      await page.getByRole('button',{name:'Мне есть 18'}).click()
      await page.locator('button.resume-card').click()
      if((await page.locator('.card-text').innerText())!==text)throw new Error('Resume changed card text')
      if(!(await page.locator('.ai-intro').innerText()).includes(intro.replace('✦ ','').trim().slice(-20))){
        throw new Error('Resume lost AI intro')
      }
    }
    await page.getByRole('button',{name:/Выполнено/}).click()
  }
  if(apiStatuses.length<2||apiStatuses.some(x=>x.status!==200)){
    throw new Error('Live Groq route did not return 200 each turn '+JSON.stringify(apiStatuses))
  }
  // Confirm the actual Sex flow uses AI without skipping Stage 0 just because
  // the player chooses three fires on the first turn.
  await page.getByRole('button',{name:'сброс'}).click()
  await page.locator('.scenario-card').filter({hasText:'Секс'}).click()
  await page.getByRole('button',{name:'Начать · Секс'}).click()
  await page.getByRole('button',{name:'Сохранить и передать'}).click()
  await page.getByRole('button',{name:/Я Игрок 2/}).click()
  await page.getByRole('button',{name:'Сохранить и начать'}).click()
  await page.getByRole('button',{name:'Риск 3'}).click()
  await page.locator('.card-text').waitFor({state:'visible',timeout:12000})
  const sexText=await page.locator('.card-text').innerText()
  const sexStatus=await page.locator('.card-topline').innerText()
  const sexIntro=await page.locator('.ai-intro').first().textContent()
  const sexSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  console.log('SEX STAGE-0 RISK-3:',JSON.stringify({sexStatus,sexText,sexIntro,stage:sexSaved?.director?.sessionStage,apiStatuses}))
  if(!sexIntro?.includes('AI DIRECTOR'))throw new Error('Sex mode did not get real AI')
  if(!sexStatus.includes('🔥🔥🔥'))throw new Error('Sex risk 3 was mislabeled')
  if(sexSaved?.director?.sessionStage!==0)throw new Error('Sex stage jumped during risk selection')
  if(/(?:проникновени|кунилингус|минет|занимайтесь сексом)/i.test(sexText)){
    throw new Error('Sex stage 0 jumped straight to direct sex')
  }
  if(apiStatuses.some(x=>x.status!==200))throw new Error('Live Groq route failed: '+JSON.stringify(apiStatuses))
  // Production test: AI WRITES a unique constraint and a separate AI judge
  // approves it. Rejection is valid behavior and must not insert canned text.
  const modifierStatuses=[]
  page.on('response',async response=>{
    if(response.url().includes('/game/modifier')){
      modifierStatuses.push({status:response.status()})
      if(!response.ok())console.log('CREATIVE AI REJECTED:',await response.text().catch(()=>'?'))
    }
  })
  let directorRateLimited=false
  await page.route('**/game/director',async route=>{
    const request=route.request().postDataJSON()
    const performanceCardId='v09:afterdark-light-dare-002'
    if(!request.candidates.some((item)=>item.id===performanceCardId)){
      throw new Error('Known performance challenge is no longer in the allowed shortlist')
    }
    const response=await route.fetch()
    if(response.status()===429){
      directorRateLimited=true
      await route.fulfill({response})
      return
    }
    if(!response.ok())throw Error('Live Director unavailable: '+response.status())
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
    if(directorRateLimited){
      if(modifiers!==0)throw Error('Director 429 incorrectly added a modifier')
      upstreamLimited=true
      console.log('PARTIAL: Director request rate-limited by Groq; base card and fallback verified.')
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
