const { getPartenaires, getCommandes, setCommandes } = require("./_store");

function jourValide(partenaire) {
  if (!partenaire.joursActifs || partenaire.joursActifs.length === 0) return true;
  return partenaire.joursActifs.includes(new Date().getDay());
}

function calculerMontant(type, valeur, montantTotal) {
  return type === "pourcentage" ? Math.round(montantTotal * (valeur / 100)) : valeur;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "Méthode non autorisée" });
  }

  try {
    const data = req.body || {};
    const montantTotal = Number(data.montantTotal) || 0;
    let remise = 0;
    let commission = 0;
    let partenaireId = null;
    let codeFinal = "";

    if (data.code) {
      const partenaires = await getPartenaires();
      const codeNormalise = String(data.code).trim().toUpperCase();
      const partenaire = partenaires.find(
        (p) => (p.code || "").toUpperCase() === codeNormalise && p.actif && jourValide(p)
      );
      if (partenaire) {
        remise = calculerMontant(partenaire.remiseType, partenaire.remiseValeur, montantTotal);
        if (remise > montantTotal) remise = montantTotal;
        commission = calculerMontant(partenaire.commissionType, partenaire.commissionValeur, montantTotal);
        partenaireId = partenaire.id;
        codeFinal = partenaire.code;
      }
    }

    const commandes = await getCommandes();
    const nouvelleCommande = {
      id: "CMD-" + Date.now(),
      date: new Date().toISOString(),
      nomClient: data.nomClient || "",
      telClient: data.telClient || "",
      localisation: data.localisation || "",
      modePaiement: data.modePaiement || "",
      montantTotal,
      code: codeFinal,
      remise,
      commission,
      partenaireId,
      statutLivraison: "en_attente",
      statutCommission: "impaye"
    };
    commandes.push(nouvelleCommande);
    await setCommandes(commandes);

    return res.status(200).json({
      succes: true,
      message: "Commande enregistrée en attente de paiement",
      commandeId: nouvelleCommande.id
    });
  } catch (err) {
    return res.status(500).json({ erreur: "Erreur lors de la commande", details: err.message });
  }
};
const gestionnaireCommanderOriginal = module.exports;

module.exports = async (req, res) => {
let source = (req.body && req.body.source) || "direct";

let resIntercepte = {
_status: 200,
_donnees: null,
status(code){ this._status = code; return this; },
json(donnees){ this._donnees = donnees; return this; }
};

await gestionnaireCommanderOriginal(req, resIntercepte);

if(resIntercepte._donnees && resIntercepte._donnees.commandeId){
try{
let commandes = await getCommandes();
let c = commandes.find(x => x.id === resIntercepte._donnees.commandeId);
if(c){
c.source = source;
await setCommandes(commandes);
}
}catch(e){}
}

return res.status(resIntercepte._status).json(resIntercepte._donnees);
};
