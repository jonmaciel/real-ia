export const metadata = {
  title: "Privacidade",
  alternates: { canonical: "/privacidade" },
};
export default function Privacy() {
  return (
    <article className="section prose">
      <span className="eyebrow">SEUS DADOS</span>
      <h1>Privacidade com clareza.</h1>
      <h2>Navegação pública</h2>
      <p>
        Você pode consultar imóveis sem criar uma conta. Analytics, gravação de
        áudio e histórico comportamental estão desativados. As buscas aparecem
        na URL para permitir compartilhamento; evite incluir informações
        pessoais.
      </p>
      <h2>Sua conta</h2>
      <p>
        As credenciais são encaminhadas à API independente da plataforma. A
        sessão utiliza um cookie HttpOnly, acessível apenas pelo servidor. Não
        armazenamos tokens no armazenamento local do navegador. Você pode
        alterar seu nome, encerrar a sessão e excluir sua conta na página Minha
        conta.
      </p>
      <h2>Fontes e mídias</h2>
      <p>
        Anúncios e mídias têm origem externa. Ao abrir um link ou carregar uma
        imagem autorizada, seu navegador se comunica com o serviço de origem,
        sujeito às políticas desse serviço.
      </p>
      <h2>Mapas e arredores</h2>
      <p>
        O mapa é carregado somente após sua ação e utiliza OpenStreetMap. Ao
        explorar arredores, seu navegador consulta o serviço Overpass (Private.coffee por padrão) com as
        coordenadas já publicadas do imóvel, categoria e raio selecionados.
        Esses serviços recebem dados técnicos da conexão, como IP. Não usamos
        sua geolocalização. Links de rota e localização abrem o Google Maps
        apenas quando você escolhe acessá-los.
      </p>
      <p>
        Consulte as <a className="text-link" href="https://overpass.private.coffee/#privacy-policy" target="_blank" rel="noopener noreferrer">políticas do serviço de arredores</a> e do <a className="text-link" href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.
      </p>
      <h2>Antes do lançamento público</h2>
      <p>
        O operador deve informar seus dados de identificação, canal de contato
        para direitos de titulares e os prazos de retenção aplicáveis antes de
        disponibilizar contas para uso público.
      </p>
    </article>
  );
}
