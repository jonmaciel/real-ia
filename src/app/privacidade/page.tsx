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
        Você pode consultar imóveis sem criar uma conta. Analytics e histórico
        comportamental estão desativados. Os filtros de busca aparecem
        na URL para permitir compartilhamento; evite incluir informações
        pessoais.
      </p>
      <h2>Conversa e áudio</h2>
      <p>
        Mensagens e áudios são enviados ao assistente somente quando você escolhe
        enviá-los. A gravação pede acesso ao microfone após seu clique e pode ser
        parada ou cancelada. Você pode ouvir e descartar o áudio antes de enviar.
        O áudio enviado é processado pela API da plataforma e pelo provedor de IA
        para transcrição e resposta. Evite compartilhar dados pessoais ou sensíveis.
        A Morada não cria um link público nem salva a gravação no banco de dados.
      </p>
      <p>
        A conversa e a transcrição ficam na memória desta visita e podem acompanhar
        sua navegação entre imóveis. “Limpar conversa” remove esse histórico local.
        Cancelar um envio não garante que o processamento no servidor seja interrompido.
      </p>
      <h2>Interesse em um imóvel</h2>
      <p>O formulário “Tenho interesse” envia seu nome, os contatos escolhidos e a mensagem opcional à API da Morada apenas após revisão, confirmação e consentimento explícito. O consentimento vale para contato da Morada sobre aquele imóvel e não inclui marketing. A navegação, a conversa com a IA e os áudios não criam interessados automaticamente.</p>
      <p>Os dados de contato e o acompanhamento são privados e acessíveis somente a administradores autorizados. Não são enviados à IA, ao catálogo público ou a analytics, nem persistidos no armazenamento do navegador. O registro não envia e-mail ou WhatsApp, não telefona, não confirma visita e não reserva o imóvel. Uma chave de idempotência evita duplicar a mesma solicitação em uma repetição manual.</p>
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
        Quando há coordenadas públicas, o mapa é carregado automaticamente com
        uma consulta inicial dos serviços essenciais próximos. Na configuração
        gratuita, seu navegador se comunica com OpenStreetMap e com o serviço
        Overpass (Private.coffee por padrão), enviando somente as coordenadas já
        publicadas do imóvel, categoria e raio. Se o operador ativar Google Maps,
        o mapa e os locais próximos serão fornecidos pelo Google Maps Platform.
        Alterar a categoria ou o raio inicia uma consulta ao provedor configurado.
        Esses serviços recebem dados técnicos da conexão, como IP. Não usamos
        sua geolocalização. Links de rota e localização abrem o Google Maps
        apenas quando você escolhe acessá-los na configuração gratuita.
      </p>
      <p>
        Consulte as <a className="text-link" href="https://overpass.private.coffee/#privacy-policy" target="_blank" rel="noopener noreferrer">políticas do serviço de arredores</a>, do <a className="text-link" href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> e do <a className="text-link" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</a>.
      </p>
      <p>
        Quando ativado, o uso do Google Maps também está sujeito aos <a className="text-link" href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Termos de Serviço do Google</a> e aos <a className="text-link" href="https://www.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Termos Adicionais do Google Maps</a>.
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
