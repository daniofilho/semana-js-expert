// Classe responsável por receber as URLs de rede e converter os caminhos de acordo com o host e os parâmetros do video
class Network {
  constructor({ host }) {
    this.host = host;
  }

  // Ajusta a URL
  parseManifestURL({ url, fileResolution, fileResolutionTag, hostTag }) {
    return url
      .replace(fileResolutionTag, fileResolution)
      .replace(hostTag, this.host);
  }

  // Faz download do vídeo
  async fetchFile(url) {
    const response = await fetch(url);
    return response.arrayBuffer(); // retorna como buffer para especificar pro HTML que vai ser sob demanda
  }

  // Pega a resolução correta com base no tempo que demorou para baixar o vídeo
  async getProperResolution(url) {
    const startMS = Date.now();

    const response = await fetch(url); // faz download do arquivo inteiro
    await response.arrayBuffer(); // e para o buffer para evitar ficar baixando mais coisas

    const endMS = Date.now();

    const durationMS = endMS - startMS;
    const resolutions = [
      { start: 3000, end: 20000, resolution: 144 },
      { start: 901, end: 3000, resolution: 360 },
      { start: 0, end: 900, resolution: 720 },
    ];

    // Pega a resolução com base no range de tempo que o download demorar
    const item = resolutions.find((item) => {
      return item.start <= durationMS && item.end >= durationMS;
    });

    const LOWEST_RESOLUTION = 144;

    // Se for mais que 30 segundos, retorna a menor resolução possível
    if (!item) return LOWEST_RESOLUTION;

    return item.resolution;
  }
}
