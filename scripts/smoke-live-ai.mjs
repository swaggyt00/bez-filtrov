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
  console.log('PASS: real browser AI selection, card render, 2 turns, save/resume, CORS all passed.')
}catch(error){
  console.error('FAIL:',error)
  try{await page.screenshot({path:'live-ai-failure.png',fullPage:true})}catch{}
  process.exitCode=1
}finally{
  await browser.close()
}
