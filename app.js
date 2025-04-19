/* app.js – entkoppelt aus der früheren Inline‑Script‑Sektion
   Vollständiger React‑Code für den Mario‑Kart‑Elo‑Rechner.
   Die Service‑Worker‑Registrierung bleibt in index.html.
   → Ablageort im Repo:  /mariokart/app.js
*/

document.addEventListener('DOMContentLoaded', () => {
  const rootDiv = document.getElementById('root');
  if (!rootDiv) {
    console.error('Root‑Element #root nicht gefunden!');
    return;
  }

  /* -----------------------------------------------------------
     Hilfsfunktion: Statusanzeige (wird nur benutzt, falls bei
     der Initialisierung etwas schiefgeht, bevor React läuft)
  ----------------------------------------------------------- */
  const showStatus = (msg, isError = false) => {
    if (rootDiv) {
      const color   = isError ? 'red'  : 'blue';
      const bgColor = isError ? '#ffebeb' : '#e0f2fe';
      rootDiv.innerHTML = `<div style="color:${color};padding:20px;border:1px solid ${color};margin:20px;font-family:sans-serif;background:${bgColor};">
        <p style="margin-top:0;">${msg}</p>
        ${isError ? '<p>Öffne die Browser‑Konsole (F12), um Details zu sehen.</p>' : ''}
      </div>`;
    }
    (isError ? console.error : console.log)(msg);
  };

  try {
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      throw new Error('React oder React‑DOM konnte nicht geladen werden!');
    }

    /* ---------------------------------------------------------
       React‑Hilfen importieren
    --------------------------------------------------------- */
    const {
      useState,
      useMemo,
      useEffect,
      useCallback,
      Fragment,
      createElement
    } = React;

    /* ---------------------------------------------------------
       Konstanten & Utilities
    --------------------------------------------------------- */
    const DEFAULT_ELO       = 1000;
    const K_BASE            = 32;
    const LOCAL_STORAGE_KEY = 'mariokart-elo-react-state-v1';

    /* ---------------------------------------------------------
       Icons (minimaler Satz aus Lucide, als React‑Components)
    --------------------------------------------------------- */
    const Icon = ({size=24,color='currentColor',strokeWidth=2,children,...props}) => (
      createElement('svg', {xmlns:'http://www.w3.org/2000/svg',width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:color,strokeWidth,strokeLinecap:'round',strokeLinejoin:'round',...props}, children)
    );

    const PlusCircle = p => createElement(Icon, p,
      createElement('circle',{cx:12,cy:12,r:10}),
      createElement('path',{d:'M8 12h8'}),
      createElement('path',{d:'M12 8v8'})
    );

    const Trash2 = p => createElement(Icon, p,
      createElement('path',{d:'M3 6h18'}),
      createElement('path',{d:'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'}),
      createElement('path',{d:'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'}),
      createElement('line',{x1:10,x2:10,y1:11,y2:17}),
      createElement('line',{x1:14,x2:14,y1:11,y2:17})
    );

    const X = p => createElement(Icon, p,
      createElement('path',{d:'M18 6 6 18'}),
      createElement('path',{d:'m6 6 12 12'})
    );

    const Upload = p => createElement(Icon, p,
      createElement('path',{d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'}),
      createElement('polyline',{points:'17 8 12 3 7 8'}),
      createElement('line',{x1:12,x2:12,y1:3,y2:15})
    );

    const Settings = p => createElement(Icon, p,
      createElement('path',{d:'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'}),
      createElement('circle',{cx:12,cy:12,r:3})
    );

    /* ---------------------------------------------------------
       Elo‑Berechnung
    --------------------------------------------------------- */
    const calcElo = (playersInGame,totalPoints,settings)=>{
      if(playersInGame.length<2)return{};
      let kCC=1.0;
      if(settings.cc===100)kCC=1.05;else if(settings.cc===150)kCC=1.1;else if(settings.cc===200)kCC=1.2;
      let kCPU=1.0;
      if(settings.cpu==='leicht')kCPU=1.05;else if(settings.cpu==='mittel')kCPU=1.1;else if(settings.cpu==='schwer')kCPU=1.15;
      const K=K_BASE*kCC*kCPU;
      const out={};
      playersInGame.forEach(pi=>{
        let delta=0;
        const rI=pi.elo;
        const pI=totalPoints[pi.id];
        playersInGame.forEach(pj=>{
          if(pi.id===pj.id)return;
          const rJ=pj.elo;
          const pJ=totalPoints[pj.id];
          const exp=1/(1+Math.pow(10,(rJ-rI)/400));
          let act=0.5;
          if(pI>pJ)act=1;else if(pI<pJ)act=0;
          delta+=K*(act-exp);
        });
        out[pi.id]=Math.round(delta);
      });
      return out;
    };

    /* ---------------------------------------------------------
       Komponenten
    --------------------------------------------------------- */

    // ConfirmDialog ---------------------------------------------------------
    const ConfirmDialog = ({isOpen,onClose,onConfirm,title,children})=>{
      useEffect(()=>{
        if(isOpen){
          const t=setTimeout(()=>{
            const el=document.getElementById('confirm-dialog');
            if(el)el.classList.add('open');
          },10);
          return()=>clearTimeout(t);
        }else{
          const el=document.getElementById('confirm-dialog');
          if(el)el.classList.remove('open');
        }
      },[isOpen]);
      if(!isOpen)return null;
      return createElement('div',{id:'confirm-dialog',className:'confirm-dialog-backdrop',role:'dialog','aria-modal':'true','aria-labelledby':'confirm-dialog-title',onClick:onClose},
        createElement('div',{className:'confirm-dialog-content',onClick:e=>e.stopPropagation()},
          createElement('h3',{id:'confirm-dialog-title',className:'text-lg font-medium text-gray-900 mb-2'},title||'Bestätigung'),
          createElement('div',{className:'text-sm text-gray-600 mb-4'},children),
          createElement('div',{className:'flex justify-end gap-3'},
            createElement('button',{type:'button',onClick:onClose,className:'px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1'},'Abbrechen'),
            createElement('button',{type:'button',onClick:()=>{onConfirm();onClose();},className:'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1'},'Bestätigen')
          )
        )
      );
    };

    // PlayerForm ------------------------------------------------------------
    const PlayerForm = ({onAddPlayer})=>{
      const [name,setName]=useState('');
      const [elo,setElo]=useState('');
      const submit=e=>{
        e.preventDefault();
        const trimmed=name.trim();
        if(!trimmed)return alert('Spielername darf nicht leer sein.');
        const eloVal=elo.trim()===''?undefined:parseInt(elo,10);
        if(elo.trim()!==''&&(isNaN(eloVal)||!Number.isInteger(eloVal)))return alert('Elo muss eine ganze Zahl sein.');
        onAddPlayer(trimmed,eloVal);
        setName('');setElo('');
      };
      return createElement('form',{onSubmit:submit,className:'mb-6 p-4 border border-gray-300 rounded-lg shadow bg-white'},
        createElement('h2',{className:'text-xl font-semibold mb-3 text-gray-700'},'Neuen Spieler hinzufügen'),
        createElement('div',{className:'flex flex-col sm:flex-row gap-3 items-stretch sm:items-center'},
          createElement('input',{type:'text',value:name,onChange:e=>setName(e.target.value),placeholder:'Spielername',required:true,'aria-label':'Spielername',className:'flex-grow p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none'}),
          createElement('input',{type:'number',value:elo,onChange:e=>setElo(e.target.value),placeholder:`Elo (Standard: ${DEFAULT_ELO})`,step:1,'aria-label':'Anfangs-Elo (optional)',className:'w-full sm:w-44 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none'}),
          createElement('button',{type:'submit',className:'flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition'},
            createElement(PlusCircle,{size:18,className:'mr-1 shrink-0'}),' Hinzufügen'
          )
        )
      );
    };

    // Leaderboard -----------------------------------------------------------
    const Leaderboard = ({players,onRequestDelete})=>createElement('div',{className:'p-4 border border-gray-300 rounded-lg shadow bg-white'},
      createElement('h2',{className:'text-xl font-semibold mb-3 text-gray-700'},'Rangliste'),
      players.length===0?
        createElement('p',{className:'text-gray-500 italic'},'Noch keine Spieler hinzugefügt.'):
        createElement('div',{className:'overflow-x-auto'},
          createElement('table',{className:'min-w-full divide-y divide-gray-200'},
            createElement('thead',{className:'bg-gray-50'},
              createElement('tr',null,
                createElement('th',{className:'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16'},'Rang'),
                createElement('th',{className:'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'},'Name'),
                createElement('th',{className:'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24'},'Elo'),
                createElement('th',{className:'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20'},'Aktion')
              )
            ),
            createElement('tbody',{className:'bg-white divide-y divide-gray-200'},
              players.map((p,i)=>createElement('tr',{key:p.id,className:'hover:bg-gray-50 transition'},
                createElement('td',{className:'px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-center'},i+1),
                createElement('td',{className:'px-4 py-2 whitespace-nowrap text-sm text-gray-700'},p.name),
                createElement('td',{className:'px-4 py-2 whitespace-nowrap text-sm text-gray-700'},p.elo),
                createElement('td',{className:'px-4 py-2 whitespace-nowrap text-sm'},
                  createElement('button',{onClick:()=>onRequestDelete(p),className:'text-red-600 hover:text-red-800 transition',title:`Spieler ${p.name} löschen`,'aria-label':`Spieler ${p.name} löschen`},createElement(Trash2,{size:18}))
                )
              ))
            )
          )
        )
    );

    // GameForm --------------------------------------------------------------
    const GameForm = ({players,onGameRecorded,lastPlayerIds})=>{
      const [sel,setSel]=useState([]);
      const [points,setPoints]=useState({});
      const [showAdv,setShowAdv]=useState(false);
      const [settings,setSettings]=useState({races:4,cc:150,cpu:'schwer'});

      // letzte Spieler vorbelegen
      useEffect(()=>{
        if(sel.length===0&&lastPlayerIds&&lastPlayerIds.length>=2){
          const v=lastPlayerIds.filter(id=>players.some(p=>p.id===id));
          if(v.length>=2){setSel(v);setPoints({});}
        }},[lastPlayerIds,players]);

      const avail=useMemo(()=>players.filter(p=>!sel.includes(p.id)),[players,sel]);
      const selDetails=useMemo(()=>players.filter(p=>sel.includes(p.id)),[players,sel]);

      const add=id=>sel.length<4&&!sel.includes(id)&&setSel([...sel,id]);
      const rem=id=>{setSel(sel.filter(x=>x!==id));setPoints({});};

      const changePts=(id,v)=>{
        const str=v.trim();
        if(str==='')return setPoints(prev=>({...prev,[id]:''}));
        const num=parseInt(str,10);
        const max=settings.races*15;
        if(!isNaN(num)&&num>=0&&num<=max){
          setPoints(prev=>({...prev,[id]:num}));
        }else{
          alert(`Punkte müssen zwischen 0 und ${max} liegen.`);
          setPoints(prev=>({...prev,[id]:''}));
        }
      };

      const applySettings=e=>{
        const {name,value}=e.target;
        setSettings(prev=>({...prev,[name]:(name==='races'||name==='cc')?parseInt(value,10):value}));
      };

      const submit=e=>{
        e.preventDefault();
        if(sel.length<2)return alert('Bitte mindestens 2 Spieler auswählen.');
        const valid=sel.reduce((acc,id)=>{const p=points[id];if(p!==''&&p!==undefined&&!isNaN(parseInt(p,10)))acc[id]=parseInt(p,10);return acc;},{});
        if(Object.keys(valid).length!==sel.length)return alert('Für alle Spieler Punkte eingeben.');
        onGameRecorded(sel,valid,settings);
        setPoints({});
      };

      const disable=sel.length<2||sel.some(id=>points[id]===''||points[id]===undefined);

      return createElement('form',{onSubmit:submit,className:'mb-6 p-4 border border-gray-300 rounded-lg shadow bg-white'},
        createElement('h2',{className:'text-xl font-semibold mb-3 text-gray-700'},'Neues Spiel eintragen'),

        /* Spieler Chips + Select */
        createElement('div',{className:'mb-4'},
          createElement('label',{className:'block text-sm font-medium text-gray-600 mb-1'},'Spieler auswählen (2-4):'),
          createElement('div',{className:'flex flex-wrap gap-2 mb-2 min-h-[38px] items-center'},
            selDetails.map(p=>createElement('div',{key:p.id,className:'flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium'},
              p.name,
              createElement('button',{type:'button',onClick:()=>rem(p.id),className:'ml-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-200 p-0.5','aria-label':`Spieler ${p.name} entfernen`},createElement(X,{size:14,strokeWidth:3}))
            )),
            sel.length<4&&avail.length>0&&createElement('select',{onChange:e=>add(e.target.value),value:'',className:'p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:w-auto','aria-label':'Weiteren Spieler zum Spiel hinzufügen'},
              createElement('option',{value:'',disabled:true},'-- Spieler hinzufügen --'),
              avail.map(p=>createElement('option',{key:p.id,value:p.id},`${p.name} (${p.elo})`))
            ),
            sel.length>=4&&createElement('p',{className:'text-sm text-gray-500 mt-1'},'Maximale Spieleranzahl (4) erreicht.')
          ),
          /* Punkteingabe */
          sel.length>=2&&createElement('div',{className:'mb-4'},
            createElement('label',{className:'block text-sm font-medium text-gray-600 mb-2'},`Gesamtpunkte eingeben (max. ${settings.races*15} bei ${settings.races} Rennen):`),
            createElement('div',{className:'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3'},
              selDetails.map(p=>createElement('div',{key:p.id,className:'flex items-center gap-2'},
                createElement('label',{htmlFor:`points-${p.id}`,className:'font-medium w-2/5 truncate',title:p.name},`${p.name}:`),
                createElement('input',{id:`points-${p.id}`,type:'number',min:0,max:settings.races*15,step:1,value:points[p.id]??'',onChange:e=>changePts(p.id,e.target.value),placeholder:'Punkte',required:true,className:'w-3/5 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none'})
              ))
            )
          )
        ),

        /* Erweiterte Einstellungen */
        createElement('div',{className:'mb-4'},
          createElement('button',{type:'button',onClick:()=>setShowAdv(!showAdv),className:'text-sm text-blue-600 hover:text-blue-800 flex items-center','aria-expanded':showAdv},createElement(Settings,{size:16,className:'mr-1'}),` Erweiterte Einstellungen ${showAdv?'ausblenden':'anzeigen'}`)
        ),
        showAdv&&createElement('div',{className:'mb-4 p-3 border border-gray-200 rounded-md bg-gray-50 grid grid-cols-1 sm:grid-cols-3 gap-4'},
          createElement('div',null,
            createElement('label',{htmlFor:'races',className:'block text-sm font-medium text-gray-600 mb-1'},'Rennen:'),
            createElement('select',{id:'races',name:'races',value:settings.races,onChange:applySettings,className:'w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none'},[4,6,8,10,12].map(r=>createElement('option',{key:r,value:r},r)))
          ),
          createElement('div',null,
            createElement('label',{htmlFor:'cc',className:'block text-sm font-medium text-gray-600 mb-1'},'CC-Klasse:'),
            createElement('select',{id:'cc',name:'cc',value:settings.cc,onChange:applySettings,className:'w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none'},[50,100,150,200].map(c=>createElement('option',{key:c,value:c},`${c}cc`)))
          ),
          createElement('div',null,
            createElement('label',{htmlFor:'cpu',className:'block text-sm font-medium text-gray-600 mb-1'},'CPU:'),
            createElement('select',{id:'cpu',name:'cpu',value:settings.cpu,onChange:applySettings,className:'w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none'},
              createElement('option',{value:'keine'},'Keine'),
              createElement('option',{value:'leicht'},'Leicht'),
              createElement('option',{value:'mittel'},'Mittel'),
              createElement('option',{value:'schwer'},'Schwer')
            )
          )
        ),
        createElement('button',{type:'submit',disabled:disable,className:'w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition'},'Spiel speichern & Elo berechnen')
      );
    };

    // ImportExportModal -----------------------------------------------------
    const ImportExportModal = ({isOpen,onClose,players,onRequestImportConfirm})=>{
      const [importData,setImportData]=useState('');
      const exportData=useMemo(()=>JSON.stringify(players.map(({id,name,elo})=>({id,name,elo})),null,2),[players]);
      const doImport=()=>{
        if(importData.trim()==='')return alert('Importfeld ist leer.');
        onRequestImportConfirm(importData);
      };
      if(!isOpen)return null;
      return createElement('div',{className:'fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4',onClick:onClose,role:'dialog','aria-modal':'true','aria-labelledby':'import-export-title'},
        createElement('div',{className:'bg-white rounded-lg shadow-xl p-5 sm:p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto flex flex-col',onClick:e=>e.stopPropagation()},
          createElement('button',{onClick:onClose,className:'absolute top-2 right-2 text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200','aria-label':'Schließen'},createElement(X,{size:24})),
          createElement('h2',{id:'import-export-title',className:'text-xl font-semibold mb-4 text-gray-800'},'Daten Importieren / Exportieren'),
          createElement('div',{className:'mb-5'},
            createElement('h3',{className:'text-lg font-medium mb-2 text-gray-600'},'Exportieren'),
            createElement('p',{className:'text-sm text-gray-500 mb-2'},'Kopiere den folgenden Text, um deine aktuellen Spielerdaten zu sichern:'),
            createElement('textarea',{readOnly:true,value:exportData,className:'w-full h-36 p-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-xs resize-none',onClick:e=>e.target.select(),'aria-label':'Exportierte Spielerdaten (JSON)'})
          ),
          createElement('div',null,
            createElement('h3',{className:'text-lg font-medium mb-2 text-gray-600'},'Importieren'),
            createElement('p',{className:'text-sm text-gray-500 mb-2'},'Füge hier deine Spielerdaten im JSON-Format ein. ',createElement('strong',{className:'text-red-600'},'Achtung:'),' Dies überschreibt alle aktuellen Daten.'),
            createElement('textarea',{value:importData,onChange:e=>setImportData(e.target.value),placeholder:'[{"id":"…","name":"Spieler1","elo":1000}, …]',className:'w-full h-36 p-2 border border-gray-300 rounded-md font-mono text-xs mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none','aria-label':'Spielerdaten zum Importieren (JSON)'}),
            createElement('button',{onClick:doImport,className:'w-full px-4 py-2 bg-blue-600 text
