export const GOOGLE_FONTS = [
    "Montserrat",
    "Roboto",
    "Open Sans",
    "Lato",
    "Oswald",
    "Raleway",
    "Poppins",
    "Playfair Display",
    "Bebas Neue",
    "Inter",
    "Source Sans Pro",
    "Noto Sans",
    "Nunito",
    "Ubuntu",
    "Lora",
    "Merriweather",
    "Rubik",
    "Titillium Web",
    "Work Sans",
    "Fira Sans",
    "Quicksand",
    "Josefin Sans",
    "Arimo",
    "Muli",
    "Mukta",
    "Dosis",
    "Pacifico",
    "Caveat",
    "Dancing Script",
    "Righteous",
    "Luckiest Guy",
    "Bangers",
    "Press Start 2P",
    "Cinzel",
    "Satisfy",
    "Lobster",
    "Abril Fatface",
    "Comfortaa",
    "Permanent Marker",
    "Orbitron",
    "Patua One",
    "Kanit",
    "Anton",
    "Shadows Into Light",
    "Exo 2",
    "Questrial",
    "Fredoka One",
    "Amatic SC",
    "Courgette",
    "Kaushan Script"
];

export const getGoogleFontUrl = (fontFamily: string) => {
    const formattedName = fontFamily.replace(/\s+/g, '+');
    return `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;700&display=swap`;
};

export const loadFont = (fontFamily: string) => {
    if (!fontFamily || fontFamily.includes('system-ui') || fontFamily.includes('sans-serif') && !GOOGLE_FONTS.some(f => fontFamily.includes(f))) {
        return;
    }

    // Extract the primary font name if it's a stack (e.g., "Montserrat, sans-serif")
    const primaryFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    
    const id = `google-font-${primaryFont.toLowerCase().replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = getGoogleFontUrl(primaryFont);
    document.head.appendChild(link);
};
