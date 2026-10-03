"""Map everyday language onto the legal vocabulary used in the knowledge base.

Users write "my boss hasn't paid me for 3 months"; the statute says "wages",
"employer", "time limit for payment". Expanding the query with these terms lets
TF-IDF find provisions that share no literal words with the user's sentence.
"""
import re

CONTRACTIONS = {
    "didn't": "did not", "doesn't": "does not", "don't": "do not", "won't": "will not",
    "isn't": "is not", "wasn't": "was not", "hasn't": "has not", "haven't": "have not",
    "can't": "cannot", "couldn't": "could not", "wouldn't": "would not", "aren't": "are not",
    "i'm": "i am", "he's": "he is", "she's": "she is", "they're": "they are",
}

# (trigger phrases, expansion terms)
SYNONYM_GROUPS = [
    (["boss", "employer", "company", "office", "manager", "factory", "owner of shop", "hr"],
     "employer employee workplace"),
    (["salary", "wage", "wages", "not paid", "unpaid", "pay me", "paid me", "payment pending", "dues"],
     "wages salary payment of wages time limit claim unpaid wages"),
    (["fired", "terminated", "sacked", "laid off", "layoff", "lost my job", "dismissed", "removed from job", "retrench"],
     "termination retrenchment notice compensation industrial dispute"),
    (["gratuity", "pf", "provident fund", "epf"], "gratuity provident fund retirement"),
    (["maternity", "pregnant", "pregnancy"], "maternity benefit leave"),
    (["husband", "wife", "in-laws", "in laws", "inlaws", "mother-in-law", "mother in law",
      "father-in-law", "sasural", "matrimonial home", "marriage"],
     "domestic violence cruelty husband relatives matrimonial aggrieved woman"),
    (["beat", "beats", "beating", "beaten", "hit me", "hits me", "hits my", "hit my", "slapped", "punched", "kicked", "attacked", "assaulted"],
     "hurt assault physical violence criminal force"),
    (["dowry", "gifts after marriage", "demand money from my parents", "car demand"],
     "dowry demand cruelty dowry prohibition"),
    (["thrown out", "kicked out", "throw me out", "locked out"],
     "shared household residence order eviction right to reside"),
    (["police", "cop", "cops", "constable", "inspector", "police station", "thana"],
     "police officer station house officer"),
    (["fir", "not registering", "refused to register", "refuse to file", "won't file", "not filing", "complaint not taken"],
     "first information report registration cognizable offence refusal superintendent magistrate"),
    (["arrest", "arrested", "detained", "custody", "picked up", "lock up", "lockup", "jail"],
     "arrest rights arrested person grounds of arrest bail magistrate custody"),
    (["bail"], "bail bailable non-bailable anticipatory bail"),
    (["online fraud", "online scam", "upi", "paytm", "gpay", "google pay", "phonepe", "otp", "net banking",
      "money deducted", "hacked", "scam", "scammer", "fraud call", "phishing", "clicked a link", "fake website",
      "cyber", "pretending to be"],
     "cyber fraud cheating personation computer resource online fraud identity theft"),
    (["fake profile", "fake account", "morphed", "photos", "pictures", "video", "leaked", "intimate", "nude"],
     "privacy images obscene electronic sexually explicit publishing transmitting"),
    (["blackmail", "blackmailing", "extort", "extortion", "demanding money or else"],
     "extortion criminal intimidation threat"),
    (["defective", "faulty", "broken", "damaged product", "not working", "refund", "replacement", "warranty",
      "guarantee", "seller", "shopkeeper", "amazon", "flipkart", "delivery", "product", "overcharged", "mrp",
      "service centre", "builder", "flat possession"],
     "consumer defect deficiency in service unfair trade practice refund compensation consumer commission"),
    (["cheque", "check bounce", "bounced", "dishonour", "dishonored", "insufficient funds"],
     "cheque dishonour negotiable instruments insufficient funds notice"),
    (["landlord", "tenant", "rent", "evict", "eviction", "house owner", "security deposit", "deposit back", "lease", "pg owner"],
     "tenancy lease landlord tenant eviction notice possession security deposit"),
    (["accident", "hit by a car", "hit by car", "hit by bike", "vehicle", "truck", "hit and run", "rash driving"],
     "motor accident compensation claims tribunal negligence driving"),
    (["touch", "touches", "touched", "touching", "harass", "harasses", "harassed", "harassment", "colleague", "inappropriate",
      "sexual comments", "sexual favour", "sexual favours", "lewd"],
     "sexual harassment workplace modesty woman internal committee"),
    (["stalk", "stalking", "following me", "follows me", "keeps messaging", "keeps calling"],
     "stalking woman follows contact"),
    (["threat", "threaten", "threatened", "threatening", "threatens", "kill me", "will kill"],
     "criminal intimidation threat injury"),
    (["stole", "stolen", "theft", "thief", "robbed", "robbery", "snatched", "snatching", "pickpocket"],
     "theft robbery snatching movable property"),
    (["loan", "borrowed", "lent", "money back", "owes me", "not returning money", "took money"],
     "recovery of money criminal breach of trust cheating legal notice"),
    (["cheated", "cheating", "fraud", "duped", "fooled"], "cheating fraud dishonestly inducing"),
    (["information", "rti", "file status", "government office", "government department", "application pending"],
     "right to information public authority public information officer"),
    (["old", "parents", "elderly", "old age", "son not taking care", "children not taking care", "senior", "aged",
      "my son", "my sons", "my grandson", "take care of me", "taking care of me", "look after me", "daughter-in-law"],
     "senior citizens maintenance parents welfare tribunal"),
    (["child", "minor", "kid", "girl child", "boy child", "student"],
     "child children minor protection"),
    (["teacher", "school", "corporal punishment", "principal"],
     "school education physical punishment mental harassment child"),
    (["caste", "dalit", "sc/st", "scheduled caste", "scheduled tribe", "untouchable", "casteist"],
     "scheduled castes scheduled tribes atrocities caste"),
    (["lawyer", "advocate", "free legal", "cannot afford", "can't afford", "no money for lawyer", "poor"],
     "free legal aid legal services authority"),
    (["divorce", "separation", "separated", "maintenance", "alimony", "left me", "deserted"],
     "divorce maintenance wife children alimony"),
    (["property", "land", "inheritance", "ancestral", "daughter share", "share in property", "father's will", "mother's will", "a will"],
     "succession property coparcenary inheritance daughter"),
    (["hospital", "doctor", "treatment", "medical negligence", "wrong operation", "surgery"],
     "medical negligence deficiency in service consumer hospital"),
    (["bank", "atm", "debit card", "credit card", "unauthorised transaction", "unauthorized transaction"],
     "bank unauthorised electronic transaction customer liability ombudsman"),
    (["talaq", "triple talaq", "instant talaq"], "triple talaq muslim women marriage"),
    (["acid"], "acid attack grievous hurt"),
    (["rape", "raped", "molest", "molested", "molestation", "sexual assault", "groped"],
     "sexual assault rape outraging modesty woman"),
    (["insult", "insulted", "abuse", "abused", "abusing", "gaali", "gali", "slur"],
     "insult intentional insult abuse words modesty"),
    (["defame", "defamation", "false rumours", "false rumors", "spreading lies", "reputation"],
     "defamation reputation imputation"),
    (["trespass", "entered my house", "entered my home", "broke into", "encroach", "encroachment"],
     "criminal trespass house trespass property"),
    (["forced to work", "bonded", "forced labour", "forced labor", "not allowed to leave job"],
     "forced labour bonded begar"),
    (["murder", "killed", "death"], "murder culpable homicide death"),
    (["suicide"], "abetment of suicide"),
    (["kidnap", "kidnapped", "abducted", "missing"], "kidnapping abduction"),
    (["forged", "forgery", "fake signature", "fake documents"], "forgery forged document"),
    (["equal pay", "paid less", "less than men"], "equal remuneration discrimination gender wages"),
]

_COMPILED = [
    ([re.compile(r"(?<![a-z])" + re.escape(t) + r"(?![a-z])") for t in triggers], expansion)
    for triggers, expansion in SYNONYM_GROUPS
]


def normalise(query: str) -> str:
    q = query.lower().replace("’", "'")
    for short, full in CONTRACTIONS.items():
        q = q.replace(short, full)
    return re.sub(r"\s+", " ", q).strip()


def expand_query(query: str) -> str:
    """Return the normalised query followed by legal terms for every matched trigger."""
    q = normalise(query)
    extra = []
    for patterns, expansion in _COMPILED:
        if any(p.search(q) for p in patterns):
            extra.append(expansion)
    return " ".join([q] + extra)


def matched_expansions(query: str):
    q = normalise(query)
    return [exp for patterns, exp in _COMPILED if any(p.search(q) for p in patterns)]
