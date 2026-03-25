export default async function handler(req, res) {
  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .trim();
}
    function limparTexto(texto) {
  return String(texto || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove caracteres invisíveis
    .replace(/\s+/g, " ")
    .trim();
}
    
    const query = (body?.query || "").toLowerCase();
const isCodigo = /^\d+$/.test(query.trim());
const coresConhecidas = [
  "azul", "preto", "branco", "off white", "verde", "vermelho",
  "rosa", "bege", "amarelo", "marrom", "cinza", "nude", "lilás",
  "lilas", "roxo", "laranja", "fischia", "canela", "grafite", 
];

const tamanhosConhecidos = [
  "pp", "p", "m", "g", "gg",
  "g1", "g2", "g3", "g4",
  "plus size", "plus"
];

const queryNormalizada = normalizar(query);

// detectar cor
const corBuscada = coresConhecidas.find(cor =>
  queryNormalizada.includes(normalizar(cor))
);

// detectar tamanho
const tamanhoBuscado = tamanhosConhecidos.find(tamanho =>
  queryNormalizada.includes(normalizar(tamanho))
);
    
    const match = query.match(/\d+/);
    const maxPrice = match ? parseFloat(match[0]) : null;

    const cleanQuery = query.replace(/\d+/g, "").trim();

let url;

const buscaSoCorOuTamanho =
  !isCodigo &&
  (corBuscada || tamanhoBuscado) &&
  normalizar(cleanQuery).split(" ").filter(p => p.length > 1).every(p =>
    [...coresConhecidas, ...tamanhosConhecidos].some(item =>
      normalizar(item) === p
    )
  );

if (isCodigo) {
  url = `https://nikimba.com.br/wp-json/wc/v3/products?sku=${query}&per_page=100&status=publish`;
} else if (buscaSoCorOuTamanho) {
  url = `https://nikimba.com.br/wp-json/wc/v3/products?per_page=100&orderby=date&order=desc&status=publish&stock_status=instock`;
} else {
  url = `https://nikimba.com.br/wp-json/wc/v3/products?search=${encodeURIComponent(cleanQuery)}&per_page=100&orderby=date&order=desc&status=publish&stock_status=instock`;
}
    const auth = Buffer.from("ck_0bda750a7b71cf6c7bf8c243b9c889e250cbb5b1:cs_1d38210914534ee7d7729da8a2aae473301f78d2").toString("base64");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    const data = await response.json();

    console.log("RETORNO API:", data);

    if (!Array.isArray(data)) {
      return res.status(200).json({
        erro: "Erro ao buscar produtos",
        detalhe: data
      });
    }

    let produtos = data;

    if (maxPrice) {
      produtos = produtos.filter(p => parseFloat(p.price) <= maxPrice);
    }
if (corBuscada || tamanhoBuscado) {
  produtos = produtos.filter(p => {
    const atributos = p.attributes || [];

    const cores = atributos
      .filter(a => normalizar(a.name || "").includes("cor"))
      .flatMap(a => a.options || [])
      .map(op => normalizar(op));

    const tamanhos = atributos
      .filter(a => normalizar(a.name || "").includes("tamanho"))
      .flatMap(a => a.options || [])
      .map(op => normalizar(op));

const corOk = corBuscada
  ? cores.some(c => {
      const corItem = normalizar(c);
      const corBusca = normalizar(corBuscada);

      return (
        corItem.includes(corBusca) ||
        corBusca.includes(corItem)
      );
    })
  : true;
    const tamanhoOk = tamanhoBuscado ? tamanhos.some(t => t.includes(normalizar(tamanhoBuscado))) : true;

    return corOk && tamanhoOk;
  });
}
 const palavras = normalizar(cleanQuery).split(" ").filter(p => p.length > 2);

if (palavras.length) {
  produtos = produtos.filter(p => {
    const texto = normalizar(`
      ${p.name}
      ${p.slug}
      ${p.description || ""}
      ${p.short_description || ""}
    `);

    return palavras.every(palavra => texto.includes(palavra));
  });
}
    if (produtos.length === 0) {
      produtos = data;
    }

    produtos = produtos.slice(0, 5);

 const resultado = produtos.map(p => {
  const atributos = p.attributes || [];

  const coresAttr = atributos.find(a =>
    limparTexto(a.name).toLowerCase().includes("cor")
  );

  const tamanhosAttr = atributos.find(a =>
    limparTexto(a.name).toLowerCase().includes("tamanho")
  );

  return {
    sku: limparTexto(p.sku || ""),
    nome: limparTexto(p.name),
    preco: p.price ? `R$ ${parseFloat(p.price).toFixed(2).replace(".", ",")}` : "",
    link: limparTexto(p.permalink),
    imagem: limparTexto(p.images?.[0]?.src || ""),
    cores: (coresAttr?.options || []).map(limparTexto),
    tamanhos: (tamanhosAttr?.options || []).map(limparTexto)
  };
});

if (!resultado || resultado.length === 0) {
  return res.status(200).json({
    encontrado: false,
    mensagem: "Não encontrei um produto com esse termo. Tente pesquisar por nome, código ou característica.",
    produtos: []
  });
}

const mensagens = resultado.slice(0, 3).map((p, i) => {
  const linhas = [
    `${p.nome}`,
    p.sku ? `Código: ${p.sku}` : null,
    p.preco ? `Preço: ${p.preco}` : null,
    p.cores.length ? `Cores: ${p.cores.join(", ")}` : null,
    p.tamanhos.length ? `Tamanhos: ${p.tamanhos.join(", ")}` : null,
    "", // espaço antes do link
    p.link
  ].filter(Boolean);

  return linhas.join("\n");
});


    return res.status(200).json({
  encontrado: true,
      mensagem: `Veja as opções que encontrei para você:\n\n${listaFormatada}`,
  mensagem_1: mensagens[0] || "",
  mensagem_2: mensagens[1] || "",
  mensagem_3: mensagens[2] || "",
  produtos: resultado
});
    
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      erro: "Erro interno no servidor",
      detalhe: error.message
    });
  }
}
