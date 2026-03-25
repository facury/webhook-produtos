export default async function handler(req, res) {
  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    function limparTexto(texto) {
      return String(texto || "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizar(texto) {
      return limparTexto(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function singularizar(palavra) {
      return String(palavra || "")
        .replace(/oes$/i, "ao")
        .replace(/aes$/i, "ao")
        .replace(/ais$/i, "al")
        .replace(/eis$/i, "el")
        .replace(/ois$/i, "ol")
        .replace(/res$/i, "r")
        .replace(/s$/i, "");
    }

    const queryOriginal = limparTexto(body?.query || "");
    const query = queryOriginal.toLowerCase();
    const queryNormalizada = normalizar(query);

    const coresConhecidas = [
      "azul", "preto", "branco", "off white", "verde", "vermelho",
      "rosa", "bege", "amarelo", "marrom", "cinza", "nude", "lilás",
      "lilas", "roxo", "laranja", "fucsia", "fuschia", "canela",
      "grafite", "vinho", "mescla", "caramelo", "petroleo", "petróleo",
      "telha", "terra", "orquidea", "orquídea", "beterraba", "chumbo"
    ];

    const tamanhosConhecidos = [
      "pp", "p", "m", "g", "gg",
      "g1", "g2", "g3", "g4", "g5", "g6",
      "plus size", "plus"
    ];

    const stopwords = [
      "tem", "tenho", "quero", "gostaria", "oi", "ola", "olá",
      "uma", "um", "de", "do", "da", "das", "dos",
      "pra", "para", "ver", "me", "mostrar", "mostra",
      "algo", "com", "na", "no", "nas", "nos", "e", "ou"
    ];

    const skuEncontrado = queryNormalizada.match(/\b\d{4,}\b/)?.[0] || null;
    const isCodigo = !!skuEncontrado;

    const corBuscada = coresConhecidas.find(cor =>
      queryNormalizada.includes(normalizar(cor))
    ) || null;

    const tamanhoBuscado = tamanhosConhecidos.find(tamanho =>
      queryNormalizada.includes(normalizar(tamanho))
    ) || null;

    const matchPreco = queryNormalizada.match(/\b(\d{2,5})\b/);
    const maxPrice = !isCodigo && matchPreco ? parseFloat(matchPreco[1]) : null;

    let querySemFiltros = queryNormalizada;

    if (skuEncontrado) {
      querySemFiltros = querySemFiltros.replace(new RegExp(`\\b${skuEncontrado}\\b`, "g"), " ");
    }

    if (corBuscada) {
      querySemFiltros = querySemFiltros.replace(normalizar(corBuscada), " ");
    }

    if (tamanhoBuscado) {
      querySemFiltros = querySemFiltros.replace(normalizar(tamanhoBuscado), " ");
    }

    if (maxPrice) {
      querySemFiltros = querySemFiltros.replace(/\b\d{2,5}\b/g, " ");
    }

    querySemFiltros = querySemFiltros
      .replace(/[.,!?;:/\-()]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const palavrasProduto = querySemFiltros
      .split(" ")
      .map(p => singularizar(p))
      .filter(p => p.length > 0 && !stopwords.includes(p));

    let url;

    // Busca ampla para permitir filtro AND confiável
    if (isCodigo) {
      url = `https://nikimba.com.br/wp-json/wc/v3/products?sku=${encodeURIComponent(skuEncontrado)}&per_page=100&status=publish`;
    } else {
      url = `https://nikimba.com.br/wp-json/wc/v3/products?per_page=100&orderby=date&order=desc&status=publish&stock_status=instock`;
    }

    const auth = Buffer.from(
      "SUA_CONSUMER_KEY:SUA_CONSUMER_SECRET"
    ).toString("base64");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    const data = await response.json();

    if (!Array.isArray(data)) {
      return res.status(200).json({
        encontrado: false,
        mensagem: "Não consegui consultar o catálogo no momento.",
        produtos: []
      });
    }

    let produtos = data;

    produtos = produtos.filter(p => {
      const texto = normalizar(`
        ${p.name || ""}
        ${p.slug || ""}
        ${p.description || ""}
        ${p.short_description || ""}
      `)
        .split(" ")
        .map(parte => singularizar(parte))
        .join(" ");

      const atributos = Array.isArray(p.attributes) ? p.attributes : [];

      const cores = atributos
        .filter(a => normalizar(a.name || "").includes("cor"))
        .flatMap(a => Array.isArray(a.options) ? a.options : [])
        .map(op => normalizar(op));

      const tamanhos = atributos
        .filter(a => normalizar(a.name || "").includes("tamanho"))
        .flatMap(a => Array.isArray(a.options) ? a.options : [])
        .map(op => normalizar(op));

      const sku = normalizar(p.sku || "");

      const skuOk = skuEncontrado ? sku === normalizar(skuEncontrado) : true;

      const corOk = corBuscada
        ? cores.some(c => {
            const corItem = normalizar(c);
            const corFiltro = normalizar(corBuscada);
            return corItem.includes(corFiltro) || corFiltro.includes(corItem);
          })
        : true;

      const tamanhoOk = tamanhoBuscado
        ? tamanhos.some(t => {
            const tamanhoItem = normalizar(t);
            const tamanhoFiltro = normalizar(tamanhoBuscado);
            return tamanhoItem === tamanhoFiltro || tamanhoItem.includes(tamanhoFiltro);
          })
        : true;

      const precoOk = maxPrice
        ? parseFloat(p.price || "0") <= maxPrice
        : true;

      const produtoOk = palavrasProduto.length
        ? palavrasProduto.every(palavra => texto.includes(palavra))
        : true;

      return skuOk && corOk && tamanhoOk && precoOk && produtoOk;
    });

    produtos = produtos.slice(0, 5);

    const resultado = produtos.map(p => {
      const atributos = Array.isArray(p.attributes) ? p.attributes : [];

      const coresAttr = atributos.find(a =>
        normalizar(a.name || "").includes("cor")
      );

      const tamanhosAttr = atributos.find(a =>
        normalizar(a.name || "").includes("tamanho")
      );

      return {
        sku: limparTexto(p.sku || ""),
        nome: limparTexto(p.name || ""),
        preco: p.price
          ? `R$ ${parseFloat(p.price).toFixed(2).replace(".", ",")}`
          : "",
        link: limparTexto(p.permalink || ""),
        imagem: limparTexto(p.images?.[0]?.src || ""),
        cores: (coresAttr?.options || []).map(limparTexto),
        tamanhos: (tamanhosAttr?.options || []).map(limparTexto)
      };
    });

    if (!resultado.length) {
      return res.status(200).json({
        encontrado: false,
        mensagem: "Não encontrei um produto com esse termo. Tente pesquisar por nome, código, cor ou tamanho.",
        mensagem_1: "",
        mensagem_2: "",
        mensagem_3: "",
        produtos: []
      });
    }

    const mensagens = resultado.slice(0, 3).map((p) => {
      const linhas = [
        `${p.nome}`,
        p.sku ? `Código: ${p.sku}` : null,
        p.preco ? `Preço: ${p.preco}` : null,
        p.cores.length ? `Cores: ${p.cores.join(", ")}` : null,
        p.tamanhos.length ? `Tamanhos: ${p.tamanhos.join(", ")}` : null,
        "",
        p.link || null
      ].filter(Boolean);

      return linhas.join("\n");
    });

    return res.status(200).json({
      encontrado: true,
      mensagem: "Veja as opções que encontrei para você:",
      mensagem_1: mensagens[0] || "",
      mensagem_2: mensagens[1] || "",
      mensagem_3: mensagens[2] || "",
      produtos: resultado
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      encontrado: false,
      mensagem: "Erro interno no servidor.",
      detalhe: error.message,
      produtos: []
    });
  }
}
