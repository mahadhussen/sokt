// UI translations. Swedish, Arabic (RTL), Somali. Pure module — strings only,
// no imports from ui/services/app/model.
//
// NOTE: the official Arbetsförmedlingen activity report export (report/) stays
// Swedish regardless of UI language — it is a government document. Only the
// on-screen chrome is translated. Screen labels for employment type / survey
// live here (uiEmploymentTypeLabel/uiSurveyLabel); the Swedish export labels
// stay in report/activityReport.

import type { EmploymentType } from '../model/types'

export type Lang = 'sv' | 'ar' | 'so'

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'sv', label: 'Svenska' },
  { code: 'ar', label: 'العربية' },
  { code: 'so', label: 'Soomaali' },
]

export function dirFor(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

type Dict = Record<string, string>

const sv: Dict = {
  'tagline': 'Sök jobb, ansök snabbt — aktivitetsrapporten bygger sig själv.',
  'lang.aria': 'Välj språk',
  'tab.jobb': 'Jobb',
  'tab.profil': 'Profil',
  'tab.ansokningar': 'Ansökningar',
  'tab.rapport': 'Aktivitetsrapport',
  'footer.pre': 'Jobbannonser från',
  'footer.link': 'Arbetsförmedlingens JobTech-API',
  'footer.post': '(Platsbanken), data under licens CC-BY-SA.',

  'search.qPlaceholder': 'Yrke eller sökord, t.ex. lokalvårdare',
  'search.allOrter': 'Alla orter',
  'search.allExtent': 'All omfattning',
  'search.submit': 'Sök jobb',
  'search.searching': 'Söker…',
  'search.save': '+ Spara sökningen',
  'search.savePrompt': 'Namn på sökningen',
  'filter.simpleApply': 'Bara enkel ansökan (namn, CV och brev räcker)',
  'results.count': '{total} annonser hittade, visar {shown}.',
  'results.simpleCount': '{shown} enkla ansökningar (av {total} annonser för sökningen).',
  'results.none': 'Inga annonser matchade sökningen. Prova andra filter.',
  'results.noneSimple':
    'Inga enkla ansökningar här — arbetsgivarna kräver mer än namn, CV och brev. Prova ett annat yrke eller stäng av “Bara enkel ansökan”.',
  'savedSearch.removeAria': 'Ta bort sparad sökning: {name}',
  'job.ad': 'Annons ↗',
  'job.apply': 'Ansök',
  'job.close': 'Stäng',

  'apply.openUrl': 'Öppna ansökningssidan ↗',
  'apply.email': 'Skicka ansökan via e-post ({email})',
  'apply.instructions': 'Se ansökningsinstruktioner i annonsen ↗',
  'apply.letterLabel': 'Personligt brev (anpassat för den här tjänsten)',
  'apply.copyLetter': 'Kopiera brev',
  'apply.copied': 'Kopierat ✓',
  'apply.resetLetter': 'Återställ från grundbrev',
  'apply.noProfileTip': 'Tips: fyll i din profil och ditt grundbrev så anpassas brevet per jobb.',
  'apply.cvReady': 'CV redo att bifoga: {fileName}. Bifoga det i kanalen ovan.',
  'apply.cvTip': 'Tips: ladda upp ditt CV under Profil så har du det redo att bifoga.',
  'apply.date': 'Datum',
  'apply.employmentType': 'Anställningsform',
  'apply.choose': 'Välj…',
  'apply.ort': 'Ort',
  'apply.surveyAnswered': 'Besvarade urvalsfrågor',
  'apply.log': 'Logga ansökan',

  'employment.heltid': 'Heltid',
  'employment.deltid': 'Deltid',
  'employment.timanstalld': 'Timanställd',
  'survey.yes': 'Ja',
  'survey.no': 'Nej',

  'consent.title': 'Samtycke',
  'consent.body':
    'För att spara din profil, ditt CV och dina ansökningar behöver du samtycka till att Sökt lagrar dina personuppgifter. Allt sparas bara lokalt i den här webbläsaren — inget skickas till någon server och inget delas. Du kan när som helst exportera eller radera allt.',
  'consent.checkbox': 'Jag samtycker till att mina uppgifter sparas lokalt.',
  'consent.continue': 'Fortsätt',
  'profile.loading': 'Laddar…',

  'cv.title': 'CV',
  'cv.charsRead': '{n} tecken inlästa',
  'cv.noText': 'ingen text inläst',
  'cv.download': 'Ladda ner',
  'cv.remove': 'Ta bort CV',
  'cv.empty': 'Ladda upp ditt CV som PDF så har du det redo att bifoga vid varje ansökan.',
  'cv.uploadAria': 'Ladda upp CV',
  'cv.reading': 'Läser in CV…',

  'data.title': 'Dina uppgifter',
  'data.body':
    'Exportera allt du sparat, eller radera det helt. Radering tar bort profil, ansökningar och CV från den här webbläsaren och går inte att ångra.',
  'data.export': 'Exportera som JSON',
  'data.deleteConfirm': 'Ja, radera allt',
  'data.cancel': 'Avbryt',
  'data.delete': 'Radera all data',

  'profile.title': 'Profil',
  'field.firstName': 'Förnamn',
  'field.lastName': 'Efternamn',
  'field.email': 'E-post',
  'field.phone': 'Telefon',
  'field.address': 'Adress',
  'field.city': 'Ort',
  'profile.baseLetter': 'Personligt brev (grundversion, återanvänds vid varje ansökan)',
  'profile.baseLetterPlaceholder': 'Skriv ditt grundbrev en gång — det följer med i varje ansökan.',
  'profile.save': 'Spara profil',
  'profile.saved': 'Sparad ✓',

  'apps.empty': 'Inga loggade ansökningar ännu. Sök jobb och ansök så hamnar de här.',
  'apps.removeAria': 'Ta bort ansökan: {title}',
  'apps.remove': 'Ta bort',

  'report.intro':
    'Rapporten byggs direkt från dina loggade ansökningar. Granska den och för in uppgifterna i Mina sidor hos Arbetsförmedlingen — Sökt skickar aldrig in något åt dig.',
  'report.from': 'Från',
  'report.to': 'Till',
  'report.copy': 'Kopiera som text',
  'report.copied': 'Kopierad ✓',
  'report.downloadCsv': 'Ladda ner CSV',
  'report.emptyPeriod': 'Inga ansökningar i den valda perioden.',

  'table.jobTitle': 'Jobbtitel',
  'table.employer': 'Arbetsgivare',
  'table.employmentType': 'Anställningsform',
  'table.date': 'Datum',
  'table.survey': 'Urvalsfrågor',
  'table.ort': 'Ort',
  'table.link': 'Länk',
}

const ar: Dict = {
  'tagline': 'ابحث عن عمل، وقدّم بسرعة — يُبنى تقرير النشاط تلقائيًا.',
  'lang.aria': 'اختر اللغة',
  'tab.jobb': 'الوظائف',
  'tab.profil': 'الملف الشخصي',
  'tab.ansokningar': 'الطلبات',
  'tab.rapport': 'تقرير النشاط',
  'footer.pre': 'إعلانات الوظائف من',
  'footer.link': 'واجهة JobTech التابعة لمصلحة التوظيف',
  'footer.post': '(Platsbanken)، البيانات بموجب ترخيص CC-BY-SA.',

  'search.qPlaceholder': 'المهنة أو كلمة بحث، مثل عامل نظافة',
  'search.allOrter': 'كل المدن',
  'search.allExtent': 'كل أنواع الدوام',
  'search.submit': 'ابحث عن وظائف',
  'search.searching': 'جارٍ البحث…',
  'search.save': '+ احفظ البحث',
  'search.savePrompt': 'اسم البحث',
  'filter.simpleApply': 'التقديم السهل فقط (يكفي الاسم والسيرة الذاتية والرسالة)',
  'results.count': 'تم العثور على {total} إعلانًا، عرض {shown}.',
  'results.simpleCount': '{shown} وظائف بتقديم سهل (من أصل {total} إعلانًا للبحث).',
  'results.none': 'لا توجد إعلانات مطابقة. جرّب مرشحات أخرى.',
  'results.noneSimple':
    'لا توجد وظائف بتقديم سهل هنا — يطلب أصحاب العمل أكثر من الاسم والسيرة الذاتية والرسالة. جرّب مهنة أخرى أو أوقف «التقديم السهل فقط».',
  'savedSearch.removeAria': 'حذف البحث المحفوظ: {name}',
  'job.ad': 'الإعلان ↗',
  'job.apply': 'تقديم',
  'job.close': 'إغلاق',

  'apply.openUrl': 'افتح صفحة التقديم ↗',
  'apply.email': 'أرسل الطلب عبر البريد الإلكتروني ({email})',
  'apply.instructions': 'اطّلع على تعليمات التقديم في الإعلان ↗',
  'apply.letterLabel': 'رسالة تعريفية (مخصّصة لهذه الوظيفة)',
  'apply.copyLetter': 'انسخ الرسالة',
  'apply.copied': 'تم النسخ ✓',
  'apply.resetLetter': 'إعادة التعيين من الرسالة الأساسية',
  'apply.noProfileTip': 'نصيحة: املأ ملفك الشخصي ورسالتك الأساسية لتُخصَّص الرسالة لكل وظيفة.',
  'apply.cvReady': 'السيرة الذاتية جاهزة للإرفاق: {fileName}. أرفقها في القناة أعلاه.',
  'apply.cvTip': 'نصيحة: ارفع سيرتك الذاتية في الملف الشخصي لتكون جاهزة للإرفاق.',
  'apply.date': 'التاريخ',
  'apply.employmentType': 'نوع التوظيف',
  'apply.choose': 'اختر…',
  'apply.ort': 'المدينة',
  'apply.surveyAnswered': 'أجبت على أسئلة الفرز',
  'apply.log': 'سجّل الطلب',

  'employment.heltid': 'دوام كامل',
  'employment.deltid': 'دوام جزئي',
  'employment.timanstalld': 'بالساعة',
  'survey.yes': 'نعم',
  'survey.no': 'لا',

  'consent.title': 'الموافقة',
  'consent.body':
    'لحفظ ملفك الشخصي وسيرتك الذاتية وطلباتك، عليك الموافقة على أن يقوم Sökt بتخزين بياناتك الشخصية. كل شيء يُحفظ محليًا في هذا المتصفح فقط — لا يُرسل شيء إلى أي خادم ولا تتم مشاركة أي شيء. يمكنك تصدير كل شيء أو حذفه في أي وقت.',
  'consent.checkbox': 'أوافق على تخزين بياناتي محليًا.',
  'consent.continue': 'متابعة',
  'profile.loading': 'جارٍ التحميل…',

  'cv.title': 'السيرة الذاتية',
  'cv.charsRead': 'تمت قراءة {n} حرفًا',
  'cv.noText': 'لم يُقرأ أي نص',
  'cv.download': 'تنزيل',
  'cv.remove': 'حذف السيرة الذاتية',
  'cv.empty': 'ارفع سيرتك الذاتية بصيغة PDF لتكون جاهزة للإرفاق مع كل طلب.',
  'cv.uploadAria': 'رفع السيرة الذاتية',
  'cv.reading': 'جارٍ قراءة السيرة الذاتية…',

  'data.title': 'بياناتك',
  'data.body':
    'صدّر كل ما حفظته، أو احذفه بالكامل. الحذف يزيل الملف الشخصي والطلبات والسيرة الذاتية من هذا المتصفح ولا يمكن التراجع عنه.',
  'data.export': 'تصدير بصيغة JSON',
  'data.deleteConfirm': 'نعم، احذف كل شيء',
  'data.cancel': 'إلغاء',
  'data.delete': 'حذف جميع البيانات',

  'profile.title': 'الملف الشخصي',
  'field.firstName': 'الاسم الأول',
  'field.lastName': 'اسم العائلة',
  'field.email': 'البريد الإلكتروني',
  'field.phone': 'الهاتف',
  'field.address': 'العنوان',
  'field.city': 'المدينة',
  'profile.baseLetter': 'رسالة تعريفية (النسخة الأساسية، تُعاد في كل طلب)',
  'profile.baseLetterPlaceholder': 'اكتب رسالتك الأساسية مرة واحدة — سترافق كل طلب.',
  'profile.save': 'حفظ الملف الشخصي',
  'profile.saved': 'تم الحفظ ✓',

  'apps.empty': 'لا توجد طلبات مسجّلة بعد. ابحث عن وظائف وقدّم لتظهر هنا.',
  'apps.removeAria': 'حذف الطلب: {title}',
  'apps.remove': 'حذف',

  'report.intro':
    'يُبنى التقرير مباشرة من طلباتك المسجّلة. راجعه وأدخِل البيانات في صفحاتك لدى مصلحة التوظيف — لا يرسل Sökt أي شيء نيابةً عنك.',
  'report.from': 'من',
  'report.to': 'إلى',
  'report.copy': 'نسخ كنص',
  'report.copied': 'تم النسخ ✓',
  'report.downloadCsv': 'تنزيل CSV',
  'report.emptyPeriod': 'لا توجد طلبات في الفترة المحددة.',

  'table.jobTitle': 'المسمى الوظيفي',
  'table.employer': 'صاحب العمل',
  'table.employmentType': 'نوع التوظيف',
  'table.date': 'التاريخ',
  'table.survey': 'أسئلة الفرز',
  'table.ort': 'المدينة',
  'table.link': 'الرابط',
}

const so: Dict = {
  'tagline': 'Raadi shaqo, codso si degdeg ah — warbixinta dhaqdhaqaaqa ayaa is-dhisaysa.',
  'lang.aria': 'Dooro luqadda',
  'tab.jobb': 'Shaqooyin',
  'tab.profil': 'Astaanta',
  'tab.ansokningar': 'Codsiyada',
  'tab.rapport': 'Warbixinta dhaqdhaqaaqa',
  'footer.pre': 'Xayeysiisyada shaqada waxay ka yimaadeen',
  'footer.link': 'JobTech-API ee Xafiiska Shaqada',
  'footer.post': '(Platsbanken), xogta oo hoos timaada shatiga CC-BY-SA.',

  'search.qPlaceholder': 'Xirfad ama eray raadin, tusaale nadiifiye',
  'search.allOrter': 'Dhammaan magaalooyinka',
  'search.allExtent': 'Dhammaan noocyada waqtiga',
  'search.submit': 'Raadi shaqo',
  'search.searching': 'Waa la raadinayaa…',
  'search.save': '+ Kaydi raadinta',
  'search.savePrompt': 'Magaca raadinta',
  'filter.simpleApply': 'Kaliya codsi fudud (magac, CV iyo warqad ayaa ku filan)',
  'results.count': '{total} xayeysiis ayaa la helay, waxaa la tusayaa {shown}.',
  'results.simpleCount': '{shown} shaqo oo codsi fudud leh (ka mid ah {total} xayeysiis).',
  'results.none': 'Ma jiraan xayeysiisyo ku habboon. Isku day shaandhayn kale.',
  'results.noneSimple':
    'Halkan ma jiraan codsiyo fudud — shaqo bixiyayaashu waxay dalbanayaan wax ka badan magac, CV iyo warqad. Isku day xirfad kale ama dami “Kaliya codsi fudud”.',
  'savedSearch.removeAria': 'Tirtir raadinta la kaydiyay: {name}',
  'job.ad': 'Xayeysiis ↗',
  'job.apply': 'Codso',
  'job.close': 'Xir',

  'apply.openUrl': 'Fur bogga codsiga ↗',
  'apply.email': 'Ku dir codsiga iimayl ({email})',
  'apply.instructions': 'Ka eeg tilmaamaha codsiga xayeysiiska ↗',
  'apply.letterLabel': 'Warqad shaqsiyeed (loo habeeyay shaqadan)',
  'apply.copyLetter': 'Nuqul warqadda',
  'apply.copied': 'La nuqulay ✓',
  'apply.resetLetter': 'Ka soo celi warqadda aasaasiga ah',
  'apply.noProfileTip': 'Talo: buuxi astaantaada iyo warqaddaada aasaasiga ah si warqaddu ugu habboonaato shaqo kasta.',
  'apply.cvReady': 'CV-gu wuu diyaar u yahay in la lifaaqo: {fileName}. Ku lifaaq kanaalka kore.',
  'apply.cvTip': 'Talo: soo geli CV-gaaga qaybta Astaanta si aad diyaar ugu haysato.',
  'apply.date': 'Taariikhda',
  'apply.employmentType': 'Nooca shaqada',
  'apply.choose': 'Dooro…',
  'apply.ort': 'Magaalada',
  'apply.surveyAnswered': 'Waan ka jawaabay su’aalaha xulashada',
  'apply.log': 'Diiwaan geli codsiga',

  'employment.heltid': 'Waqti buuxa',
  'employment.deltid': 'Waqti dhiman',
  'employment.timanstalld': 'Saacad',
  'survey.yes': 'Haa',
  'survey.no': 'Maya',

  'consent.title': 'Oggolaansho',
  'consent.body':
    'Si aad u kaydiso astaantaada, CV-gaaga iyo codsiyadaada, waa inaad oggolaato in Sökt uu kaydiyo xogtaada shakhsiyeed. Wax walba waxaa lagu kaydiyaa oo keliya browserkan gudihiisa — waxba looma diro server, waxbana lama wadaago. Waqti kasta waad soo dejin kartaa ama tirtiri kartaa wax walba.',
  'consent.checkbox': 'Waan oggolahay in xogtayda lagu kaydiyo browserka gudihiisa.',
  'consent.continue': 'Sii wad',
  'profile.loading': 'Waa soo dhacayaa…',

  'cv.title': 'CV',
  'cv.charsRead': '{n} xaraf ayaa la akhriyay',
  'cv.noText': 'wax qoraal ah lama akhriyin',
  'cv.download': 'Soo deji',
  'cv.remove': 'Tirtir CV-ga',
  'cv.empty': 'Soo geli CV-gaaga oo PDF ah si aad diyaar ugu haysato codsi kasta.',
  'cv.uploadAria': 'Soo geli CV',
  'cv.reading': 'CV-ga waa la akhrinayaa…',

  'data.title': 'Xogtaada',
  'data.body':
    'Soo deji wax walba oo aad kaydisay, ama gebi ahaanba tirtir. Tirtiristu waxay ka saaraysaa astaanta, codsiyada iyo CV-ga browserkan, mana laga noqon karo.',
  'data.export': 'U soo deji JSON',
  'data.deleteConfirm': 'Haa, tirtir wax walba',
  'data.cancel': 'Jooji',
  'data.delete': 'Tirtir dhammaan xogta',

  'profile.title': 'Astaanta',
  'field.firstName': 'Magaca hore',
  'field.lastName': 'Magaca dambe',
  'field.email': 'Iimayl',
  'field.phone': 'Telefoon',
  'field.address': 'Cinwaan',
  'field.city': 'Magaalada',
  'profile.baseLetter': 'Warqad shaqsiyeed (nooca aasaasiga ah, dib loo isticmaalo codsi kasta)',
  'profile.baseLetterPlaceholder': 'Hal mar qor warqaddaada aasaasiga ah — waxay raacaysaa codsi kasta.',
  'profile.save': 'Kaydi astaanta',
  'profile.saved': 'La kaydiyay ✓',

  'apps.empty': 'Weli ma jiraan codsiyo la diiwaan geliyay. Raadi shaqo oo codso si ay halkan uga muuqdaan.',
  'apps.removeAria': 'Tirtir codsiga: {title}',
  'apps.remove': 'Tirtir',

  'report.intro':
    'Warbixinta waxaa toos looga dhisaa codsiyadaada la diiwaan geliyay. Dib u eeg oo gali xogta boggaaga Xafiiska Shaqada — Sökt waxba kuuma diro adiga.',
  'report.from': 'Laga bilaabo',
  'report.to': 'Ilaa',
  'report.copy': 'Nuqul qoraal ahaan',
  'report.copied': 'La nuqulay ✓',
  'report.downloadCsv': 'Soo deji CSV',
  'report.emptyPeriod': 'Ma jiraan codsiyo muddada la doortay.',

  'table.jobTitle': 'Cinwaanka shaqada',
  'table.employer': 'Shaqo bixiyaha',
  'table.employmentType': 'Nooca shaqada',
  'table.date': 'Taariikhda',
  'table.survey': 'Su’aalaha xulashada',
  'table.ort': 'Magaalada',
  'table.link': 'Xiriiriye',
}

const DICTS: Record<Lang, Dict> = { sv, ar, so }

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const template = DICTS[lang][key] ?? sv[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

export function uiEmploymentTypeLabel(lang: Lang, type: EmploymentType): string {
  return translate(lang, `employment.${type}`)
}

export function uiSurveyLabel(lang: Lang, answered: boolean): string {
  return translate(lang, answered ? 'survey.yes' : 'survey.no')
}
