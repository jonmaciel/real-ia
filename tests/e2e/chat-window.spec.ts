import { test, expect } from "@playwright/test";
const detail = "/imovel/2/um-novo-capitulo-no-agua-verde";
test("janela abre em 20 segundos sem geração ou roubo de foco e não reabre após minimizar", async ({page}, info) => {
 let requests=0; page.on("request",r=>{if(r.url().includes("/assistente/mensagens"))requests++;});
 await page.clock.install(); await page.goto(detail);
 const launcher=page.getByRole("button",{name:"Abrir conversa com o Morada",exact:true});
 await expect(launcher).toBeVisible();
 const share=page.getByRole("button",{name:"Compartilhar",exact:true}); await share.focus();
 await page.clock.fastForward(19000); await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.clock.fastForward(1000); await expect(page.getByRole("dialog",{name:"Converse com o Morada"})).toBeVisible();
 await expect(share).toBeFocused(); expect(requests).toBe(0);
 await page.screenshot({path:info.outputPath("floating-chat.png")});
 await page.getByRole("dialog").getByRole("button",{name:"Minimizar conversa",exact:true}).click();
 await expect(launcher).toBeFocused(); await page.clock.fastForward(60000); await expect(page.getByRole("dialog")).toHaveCount(0);
 await launcher.click(); await expect(page.getByRole("heading",{name:"Converse com o Morada",exact:true})).toBeFocused();
 const input=page.getByLabel("Sua pergunta sobre o imóvel"); await input.fill("Minha pergunta ainda não enviada"); await input.press("Escape"); await launcher.click(); await expect(input).toHaveValue("Minha pergunta ainda não enviada");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("conta tempo entre páginas e oferece contexto apenas ao abrir um imóvel",async({page})=>{
 await page.clock.install(); await page.goto("/");
 await expect(page.getByRole("button",{name:"Abrir conversa com o Morada",exact:true})).toBeVisible();
 await page.clock.fastForward(20000); const dialog=page.getByRole("dialog",{name:"Converse com o Morada"});
 await expect(dialog.getByRole("heading",{name:"Encontre seu imóvel",exact:true})).toBeVisible();
 await expect(page.getByLabel("O que você procura?")).toBeVisible();
 await page.goto("/auth/login"); await expect(page.locator(".property-chat-widget")).toHaveCount(0);
});
test("abertura automática aguarda formulário ativo",async({page})=>{
 await page.clock.install(); await page.goto("/");
 await page.getByRole("button",{name:"Abrir conversa com o Morada",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Minimizar conversa",exact:true}).click();
 // A full visit starts a fresh timer; the search input keeps focus during expiry.
 await page.goto("/");
 const input=page.locator("main input").first(); await input.focus();
 await page.clock.fastForward(22000); await expect(page.getByRole("dialog")).toHaveCount(0);
 await input.blur(); await page.clock.fastForward(2000); await expect(page.getByRole("dialog")).toBeVisible();
});
