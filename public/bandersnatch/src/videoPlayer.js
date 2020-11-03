class VideoMediaPlayer {
  constructor({ manifestJSON, network, videoComponent }) {
    this.manifestJSON = manifestJSON;
    this.network = network;
    this.videoComponent = videoComponent;

    this.videoElement = null;
    this.sourceBuffer = null;
    this.activeItem = null;
    this.selected = {};
    this.videoDuration = 0;
    this.selections = [];
  }

  initializeCodec() {
    // inicializa o DOM do vídeo
    this.videoElement = document.getElementById("vid");

    // Verifica se o browser do usuário suporta esse tipo de vídeo
    const mediaSourceSupported = !!window.MediaSource;
    if (!mediaSourceSupported) {
      alert("Seu browser não tem suporte ao MSE!");
    }

    // Verifica se o browser suporta o codec usado
    const codecSupported = MediaSource.isTypeSupported(this.manifestJSON.codec);
    if (!codecSupported) {
      alert(`Seu browser não suporta o codec ${this.manifestJSON.codec}!`);
    }

    // Inicializa o mediaSource
    const mediaSource = new MediaSource();
    this.videoElement.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener(
      "sourceopen",
      this.sourceOpenWrapper(mediaSource)
    );
  }

  // Ao carregar o source, retorna uma promise do arquivo processado
  sourceOpenWrapper(mediaSource) {
    return async (_) => {
      // Passa pro buffer qual o codec que ele vai usar
      this.sourceBuffer = mediaSource.addSourceBuffer(this.manifestJSON.codec);

      // Controla a opção que o usuário selecionou
      const selected = (this.selected = this.manifestJSON.intro);

      // Passa uma duração para que o player não exiba como "LIVE"
      mediaSource.duration = this.videoDuration;

      // Manda baixar o arquivo
      await this.fileDownload(selected.url);

      setInterval(this.waitForQuestions.bind(this), 200);
    };
  }

  // Listener que fica aguardando o momento correto para exibir o modal das opções
  waitForQuestions() {
    const currentTime = parseInt(this.videoElement.currentTime);

    // Verifica se vai exibir a opção nos modais apenas se o vídeo estiver no `at` definido no manifest.json
    const option = this.selected.at === currentTime;
    if (!option) return;

    // Se já abriu uma modal antes pra essa opção, então não abre mais
    if (this.activeItem === this.selected.url) return;

    this.videoComponent.configureModal(this.selected.options);
    this.activeItem = this.selected; // Flag para evitar modais duplicados
  }

  // Calcula o tempo de download do vídeo para determinar as próximas resoluções
  // sempre começando com o menor arquivo que possui
  async currentFileResolution() {
    const LOWEST_RESOLUTION = 144;
    const prepareUrl = {
      url: this.manifestJSON.finalizar.url,
      fileResolution: LOWEST_RESOLUTION,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag,
    };
    const url = this.network.parseManifestURL(prepareUrl);
    return this.network.getProperResolution(url);
  }

  // Insere o próximo pedaço de vídeo no buffer atual do player dando a sensação de um vídeo contínuo
  async nextChunk(data) {
    const key = data.toLowerCase(); // transforma o nome do item selecionado para lowercase para corresponder ao nome definido na chave do manifest.json
    const selected = this.manifestJSON[key];

    this.selected = {
      ...selected,
      // Ajusta o tempo que o modal vai aparecer, baseado no tempo corrente
      at: parseInt(this.videoElement.currentTime + selected.at),
    };

    this.manageLag(this.selected);

    // Deixa o restante do vídeo rodar
    this.videoElement.play();

    // Vai fazendo download do próximo vídeo
    await this.fileDownload(selected.url);
  }

  // Gerencia o tempo de resposta de carregamento do vídeo para evitar que as modais apareçam antes do que deveriam por conta do Lag/delay
  manageLag(selected) {
    if (!!~this.selections.indexOf(selected.url)) {
      // o correto aqui seria fazer um cálculo mais exato para saber o tempo que levou para o loading
      // o código abaixo está apenas simplificando este processo
      // mas essa "gambiarra" não funciona em produção!
      selected.at += 5;
      return;
    }

    this.selections.push(selected.url);
  }

  // Faz o download do vídeo
  async fileDownload(url) {
    const fileResolution = await this.currentFileResolution();

    // Passa pela classe de network para preparar a url
    const prepareUrl = {
      url,
      fileResolution,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag,
    };
    const finalUrl = this.network.parseManifestURL(prepareUrl);

    this.setVideoPlayerDuration(finalUrl);

    const data = await this.network.fetchFile(finalUrl);
    return this.processBufferSegments(data);
  }

  // Seta a duração do vídeo
  setVideoPlayerDuration(finalUrl) {
    // Pega as props do vídeo com base no nome do arquivo
    const bars = finalUrl.split("/");
    const [name, videoDuration] = bars[bars.length - 1].split("-");

    this.videoDuration += parseFloat(videoDuration);
  }

  // Função que adiciona os pedaços de vídeo sob demanda
  async processBufferSegments(allSegments) {
    const sourceBuffer = this.sourceBuffer;
    sourceBuffer.appendBuffer(allSegments);

    return new Promise((resolve, reject) => {
      // Remove o evento que estava observando essa Promse para que o próximo possa executar
      // isso evita loop infinito
      const updateEnd = (_) => {
        sourceBuffer.removeEventListener("updateend", updateEnd);
        sourceBuffer.timestampOffset = this.videoDuration;

        return resolve();
      };

      // Quando terminar de carregar um bloco de vídeo, chama funções
      sourceBuffer.addEventListener("updateend", updateEnd);
      sourceBuffer.addEventListener("error", reject);
    });
  }
}
