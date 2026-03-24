export default async function handler(req, res) {
  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const query = (body?.query || "").toLowerCase();

    const match = query.match(/\d+/);
    const maxPrice = match ? parseFloat(match[0]) : null;

    const cleanQuery = query.replace(/\d+/g, "").trim();

    const url = `https://nikimba.com.br/wp-json/wc/v3/products?search=${encodeURIComponent(cleanQuery)}&per_page=20&orderby=date&order=desc&status=publish&stock_status=instock`;

    const auth = Buffer.from("SUA_CONSUMER_KEY:SUA_CONSUMER_SECRET").toString("base64");

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

    const palavras = cleanQuery.split(" ").filter(p => p.length > 2);

    if (palavras.length) {
      produtos = produtos.filter(p =>
        palavras.some(palavra =>
          p.name.toLowerCase().includes(palavra)
        )
      );
    }

    if (produtos.length === 0) {
      produtos = data;
    }

    produtos = produtos.slice(0, 5);

    const resultado = produtos.map(p => ({
      nome: p.name,
      preco: p.price ? `R$ ${parseFloat(p.price).toFixed(2)}` : "",
      link: p.permalink,
      imagem: p.images?.[0]?.src || ""
    }));

    return res.status(200).json({ produtos: resultado });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      erro: "Erro interno no servidor",
      detalhe: error.message
    });
  }
}
