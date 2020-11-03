const MANIFEST_URL = "manifest.json";
const localHost = ["127.0.0.1", "localhost"];

async function main() {
  // Verifica se o host está em ambiente local
  const isLocal = !!~localHost.indexOf(window.location.hostname);

  // Carrega o manifest
  const manifestJSON = await (await fetch(MANIFEST_URL)).json();

  // Define o ambiente
  const host = isLocal ? manifestJSON.localHost : manifestJSON.productionHost;

  // Inicializa os componentes
  const videoComponent = new VideoComponent();
  const network = new Network({ host });
  const videoPlayer = new VideoMediaPlayer({
    manifestJSON,
    network,
    videoComponent,
  });

  videoPlayer.initializeCodec();
  videoComponent.initializePlayer();

  window.nextChunk = (data) => videoPlayer.nextChunk(data);
}

window.onload = main;
