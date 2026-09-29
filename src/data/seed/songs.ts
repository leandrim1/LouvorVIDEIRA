/**
 * Músicas de demonstração. Títulos, artistas e letras são fictícios/originais,
 * criados apenas para demonstrar o sistema. Cifras escritas no tom original.
 */

export interface SeedSong {
  title: string
  artist: string
  album: string
  composer: string
  originalKey: string
  teamKey: string
  bpm: number
  capo: number | null
  tuning: string
  timeSignature: string
  tags: string[]
  notes: string
  chords: string
}

export const SEED_SONGS: SeedSong[] = [
  {
    title: 'Tu És Bom',
    artist: 'Aurora Worship',
    album: 'Manhãs de Graça',
    composer: 'Helena Prado',
    originalKey: 'A',
    teamKey: 'A',
    bpm: 72,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['adoração', 'gratidão'],
    notes: 'Começar só com teclado e voz. Banda entra no segundo refrão.',
    chords: `[Intro]
A  E/G#  F#m  D

[Verso 1]
A                E/G#
Desde a manhã Tua mão me sustentou
F#m                D
No vale escuro Tua luz me alcançou
A                E/G#
Cada promessa que falaste se cumpriu
F#m          D            E
Meu coração em Ti descansa e sorriu

[Refrão]
D            A
Tu és bom, Tu és bom
E                 F#m
Em todo tempo eu vou cantar
D            A
Tu és bom, Tu és bom
E                   D
Tua bondade vai me acompanhar

[Ponte]
F#m         E           D
Eu vou lembrar do que fizeste
F#m         E           D
Eu vou cantar do que farás`,
  },
  {
    title: 'Grande é o Senhor',
    artist: 'Ministério Videira',
    album: 'Raízes Profundas',
    composer: 'Marcos Tavares',
    originalKey: 'C',
    teamKey: 'D',
    bpm: 80,
    capo: 2,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['celebração', 'exaltação'],
    notes: 'Violão com capo na 2ª casa usando formas de C. Virada de bateria antes do refrão.',
    chords: `[Intro]
C  G  Am  F

[Verso]
C                  G
Grande é o Senhor, Rei da criação
Am                 F
Os céus declaram a obra de Sua mão
C                  G
Montes se curvam ao Seu redor
Am          F          G
Toda a terra canta o Seu louvor

[Refrão]
F         G          C
Glória, glória ao Rei
F         G          Am
O Seu nome exaltarei
F         G        Em     Am
Grande é o Senhor, eterno amor
F           G         C
Para sempre O louvarei`,
  },
  {
    title: 'Oceanos',
    artist: 'Coletivo Semear',
    album: 'Mar Adentro',
    composer: 'Rafael Monteiro',
    originalKey: 'D',
    teamKey: 'C',
    bpm: 74,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['adoração', 'fé'],
    notes: 'Tom baixado para C para a Maria. Dinâmica crescente até a ponte.',
    chords: `[Intro]
Bm  A/C#  D  G

[Verso 1]
Bm             A/C#       D
Nas profundezas do Teu amor
          G                D
Há um silêncio que acalma a dor
Bm             A/C#       D
Cada maré me leva até Ti
       G              A
Em Teu abraço eu quero existir

[Refrão]
G           D           A
Mais profundo que o mar
       Bm          G
É o Teu jeito de amar
G           D          A
Onde eu for vou confiar
        G       A      D
Teu amor vai me guiar`,
  },
  {
    title: 'Teu Nome',
    artist: 'Casa de Oração Music',
    album: 'Nome Sobre Todo Nome',
    composer: 'Juliana Freitas',
    originalKey: 'G',
    teamKey: 'G',
    bpm: 68,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['adoração', 'Jesus'],
    notes: 'Ministração livre ao final. Líder conduz o tempo da repetição.',
    chords: `[Verso]
G               D/F#
Há um nome que acalma o mar
Em              C
Há um nome que faz o cego ver
G               D/F#
Nome acima de todo nome
Em           C           D
Jesus, ninguém é como Tu

[Refrão]
C         G          D         Em
Teu nome é forte, Teu nome é luz
C         G          D
Teu nome é vida, Jesus
C        G        D       Em
Levanto as mãos e declaro
C           D           G
Não há outro nome igual`,
  },
  {
    title: 'Vinho Novo',
    artist: 'Ministério Videira',
    album: 'Raízes Profundas',
    composer: 'Marcos Tavares',
    originalKey: 'E',
    teamKey: 'E',
    bpm: 118,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['celebração', 'abertura'],
    notes: 'Ótima para abertura. Guitarra com riff no intro.',
    chords: `[Intro]
E  B  C#m  A

[Verso]
E                     B
Há vinho novo sendo derramado
C#m                   A
Há festa nova na casa do Pai
E                     B
O que era velho já foi renovado
C#m            A            B
E a alegria não vai se acabar

[Refrão]
A          E
Enche o meu copo
B               C#m
Faz transbordar
A          E
Quero Teu vinho
B               E
Em cada lugar`,
  },
  {
    title: 'Raízes',
    artist: 'Clara Menezes',
    album: 'Terra Boa',
    composer: 'Clara Menezes',
    originalKey: 'D',
    teamKey: 'D',
    bpm: 70,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '6/8',
    tags: ['adoração', 'firmeza'],
    notes: 'Compasso 6/8 — atenção da bateria na condução.',
    chords: `[Verso]
D              G
Como árvore junto às águas
Bm             A
Minhas raízes estão em Ti
D              G
Nem o vento, nem a seca
Bm        A          D
Vão arrancar o que plantaste em mim

[Refrão]
G          D
Firmado estou
A              Bm
Na rocha eterna
G          D
Firmado estou
A           D
No Teu amor`,
  },
  {
    title: 'Casa do Pai',
    artist: 'Banda Refúgio',
    album: 'Porta Aberta',
    composer: 'André Luz',
    originalKey: 'F',
    teamKey: 'F',
    bpm: 76,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['comunhão', 'família'],
    notes: '',
    chords: `[Verso]
F               C
Volto pra casa do Pai
Dm              Bb
Onde a mesa já está posta
F               C
Onde o abraço não se cansa
Dm        Bb        C
E o amor sempre me encontra

[Refrão]
Bb          F
Aqui é meu lugar
C               Dm
Aqui eu posso descansar
Bb          F
Na casa do Pai
C              F
Eu vou morar`,
  },
  {
    title: 'Alvorada',
    artist: 'Aurora Worship',
    album: 'Manhãs de Graça',
    composer: 'Helena Prado',
    originalKey: 'E',
    teamKey: 'D',
    bpm: 84,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['esperança'],
    notes: 'Versão da equipe um tom abaixo.',
    chords: `[Verso]
E              A
Depois da noite vem a alvorada
C#m            B
Depois do choro, a alegria vem
E              A
Tua misericórdia renovada
C#m        B          E
Chega comigo toda manhã também

[Refrão]
A          E
Amanheceu, amanheceu
B              C#m
A luz do Teu favor
A          E
Amanheceu em mim
B              E
Meu Salvador`,
  },
  {
    title: 'Sopro de Vida',
    artist: 'Som do Reino',
    album: 'Vento Forte',
    composer: 'Tiago Barros',
    originalKey: 'A',
    teamKey: 'A',
    bpm: 128,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['celebração', 'Espírito Santo'],
    notes: 'Percussão marcante. Palmas no refrão.',
    chords: `[Intro]
A  D  F#m  E

[Verso]
A                  D
Sopra, vento do Espírito
F#m                E
Enche este lugar
A                  D
Onde havia ossos secos
F#m          E         A
Vida vai se levantar

[Refrão]
D       A        E        F#m
Levanta, levanta, exército
D       A       E
Canta com toda a voz
D        A       E       F#m
O Espírito se move entre nós
D        E        A
E ninguém vai calar`,
  },
  {
    title: 'Coração Grato',
    artist: 'Davi Rezende',
    album: 'Simples Assim',
    composer: 'Davi Rezende',
    originalKey: 'G',
    teamKey: 'G',
    bpm: 90,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['gratidão'],
    notes: '',
    chords: `[Verso]
G                 C
Eu tenho um coração grato
Em                D
Por tudo que fizeste por mim
G                 C
Pelo pão de cada dia
Em          D           G
Pela graça que não tem fim

[Refrão]
C       G       D      Em
Obrigado, Senhor, obrigado
C        G        D
Por me amar assim
C       G      D       Em
Obrigado, Senhor, obrigado
C        D        G
Por cuidar de mim`,
  },
  {
    title: 'Descansarei',
    artist: 'Clara Menezes',
    album: 'Terra Boa',
    composer: 'Clara Menezes',
    originalKey: 'D',
    teamKey: 'D',
    bpm: 64,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['adoração', 'paz'],
    notes: 'Ideal para momento de oração. Pad em D durante a ministração.',
    chords: `[Verso]
D           A/C#
Descansarei à sombra
Bm          G
Das Tuas asas, meu Senhor
D           A/C#
Não temerei a noite
Bm        G         A
Pois estás onde estou

[Refrão]
G       D       A
Descansarei, descansarei
G        D       A
Em Teus braços eu vou ficar
G       D       Bm
Descansarei, descansarei
G         A        D
Tua paz vai me guardar`,
  },
  {
    title: 'Hosana nas Alturas',
    artist: 'Coletivo Semear',
    album: 'Mar Adentro',
    composer: 'Rafael Monteiro',
    originalKey: 'C',
    teamKey: 'C',
    bpm: 132,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['celebração', 'exaltação'],
    notes: '',
    chords: `[Intro]
C  F  Am  G

[Verso]
C                 F
Abram caminho, o Rei vai passar
Am                G
Ramos nas mãos, vamos celebrar
C                 F
Toda a cidade vai ouvir
Am           G          C
Quem é Aquele que vem aqui

[Refrão]
F       C       G       Am
Hosana, hosana nas alturas
F       C          G
Bendito o que vem
F       C       G       Am
Hosana, hosana nas alturas
F        G         C
Glória ao Rei também`,
  },
  {
    title: 'Pão da Vida',
    artist: 'Casa de Oração Music',
    album: 'Nome Sobre Todo Nome',
    composer: 'Juliana Freitas',
    originalKey: 'Em',
    teamKey: 'Em',
    bpm: 72,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['ceia', 'comunhão'],
    notes: 'Música para o momento da Santa Ceia. Instrumental suave.',
    chords: `[Verso]
Em              C
Tu és o pão da vida
G               D
Partido por amor
Em              C
Teu corpo foi entregue
G          D         Em
Pra me dar o Teu favor

[Refrão]
C         G
Lembrarei da cruz
D              Em
Cada vez que eu comer
C         G
Lembrarei, Jesus
D              Em
Que morreste pra eu viver`,
  },
  {
    title: 'Nada Vai Me Separar',
    artist: 'Banda Refúgio',
    album: 'Porta Aberta',
    composer: 'André Luz',
    originalKey: 'Bb',
    teamKey: 'Bb',
    bpm: 80,
    capo: 3,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['fé', 'confiança'],
    notes: 'Violão com capo na 3ª casa (formas de G).',
    chords: `[Verso]
Bb             F
Nem altura nem profundidade
Gm             Eb
Nem o presente, nem o porvir
Bb             F
Nada nesta terra tem o poder
Gm         Eb          F
De me afastar de Ti

[Refrão]
Eb          Bb
Nada vai me separar
F              Gm
Do amor que me encontrou
Eb          Bb
Nada vai me separar
F              Bb
Eu sou do Senhor`,
  },
  {
    title: 'Vem Reinar',
    artist: 'Som do Reino',
    album: 'Vento Forte',
    composer: 'Tiago Barros',
    originalKey: 'A',
    teamKey: 'G',
    bpm: 70,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['adoração', 'rendição'],
    notes: '',
    chords: `[Verso]
A             E/G#
Eu abro as portas do meu coração
F#m           D
Pode entrar, Senhor, e ocupar
A             E/G#
Cada canto, cada decisão
F#m        D         E
Tudo é Teu, pode reinar

[Refrão]
D          A
Vem reinar, vem reinar
E              F#m
Sobre tudo o que sou
D          A
Vem reinar, vem reinar
E           A
És meu Senhor`,
  },
  {
    title: 'Fiel Até o Fim',
    artist: 'Davi Rezende',
    album: 'Simples Assim',
    composer: 'Davi Rezende',
    originalKey: 'Eb',
    teamKey: 'Eb',
    bpm: 68,
    capo: null,
    tuning: 'Meio tom abaixo (Eb)',
    timeSignature: '4/4',
    tags: ['fidelidade'],
    notes: 'Guitarra afinada meio tom abaixo, formas de E.',
    chords: `[Verso]
Eb              Bb
Quando tudo parecia perdido
Cm              Ab
Tua voz me chamou pelo nome
Eb              Bb
Quando o chão se abriu aos meus pés
Cm          Ab         Bb
Tua mão me ergueu de novo

[Refrão]
Ab         Eb
Fiel até o fim
Bb              Cm
Sempre foste assim
Ab         Eb
Fiel até o fim
Bb          Eb
Tu és pra mim`,
  },
  {
    title: 'Luz do Mundo',
    artist: 'Aurora Worship',
    album: 'Manhãs de Graça',
    composer: 'Helena Prado',
    originalKey: 'D',
    teamKey: 'D',
    bpm: 100,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '4/4',
    tags: ['missão', 'celebração'],
    notes: '',
    chords: `[Verso]
D               A
Uma cidade sobre o monte
Bm              G
Não se pode esconder
D               A
Uma candeia sobre a mesa
Bm          G          A
Para a casa inteira ver

[Refrão]
G          D
Somos luz, somos sal
A              Bm
Levando o Teu amor
G          D
Somos luz no mundo
A             D
Pra glória do Senhor`,
  },
  {
    title: 'Ao Que Está no Trono',
    artist: 'Ministério Videira',
    album: 'Raízes Profundas',
    composer: 'Marcos Tavares',
    originalKey: 'G',
    teamKey: 'G',
    bpm: 66,
    capo: null,
    tuning: 'Padrão (E A D G B E)',
    timeSignature: '3/4',
    tags: ['adoração', 'exaltação'],
    notes: 'Em 3/4. Encerramento do culto.',
    chords: `[Verso]
G             Em
Ao que está no trono
C             D
Honra, glória e poder
G             Em
Os anciãos se prostram
C          D         G
E coroas vão lançar a Seus pés

[Refrão]
C       G       D       Em
Santo, santo, santo é o Senhor
C       G         D
Digno de adoração
C       G       D       Em
Santo, santo, santo é o Senhor
C        D        G
Rei do meu coração`,
  },
]
