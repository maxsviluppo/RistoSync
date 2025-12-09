import { Category, MenuItem } from './types';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'a1', name: 'Bruschetta al Pomodoro', price: 6, category: Category.ANTIPASTI, description: 'Pane tostato, aglio, pomodori freschi, basilico, olio EVO.' },
  { id: 'a2', name: 'Tagliere Misto', price: 14, category: Category.ANTIPASTI, description: 'Selezione di salumi e formaggi locali con miele.' },
  { id: 'pub1', name: 'Classic Burger', price: 10, category: Category.PANINI, description: 'Hamburger di manzo 180g, lattuga, pomodoro, salsa BBQ, patatine.' },
  { id: 'pub2', name: 'Cheeseburger Bacon', price: 12, category: Category.PANINI, description: 'Hamburger di manzo, cheddar, bacon croccante, cipolla caramellata.' },
  { id: 'pub3', name: 'Club Sandwich', price: 11, category: Category.PANINI, description: 'Pollo grigliato, bacon, uovo, lattuga, pomodoro, maionese.' },
  { id: 'p1', name: 'Carbonara', price: 12, category: Category.PRIMI, description: 'Spaghetti, guanciale croccante, pecorino romano, uova, pepe nero.' },
  { id: 'p2', name: 'Amatriciana', price: 11, category: Category.PRIMI, description: 'Bucatini, guanciale, pomodoro San Marzano, pecorino.' },
  { id: 'p3', name: 'Risotto ai Funghi', price: 13, category: Category.PRIMI, description: 'Riso Carnaroli, funghi porcini freschi, prezzemolo, burro.' },
  { id: 's1', name: 'Tagliata di Manzo', price: 18, category: Category.SECONDI, description: 'Controfiletto di manzo, rucola, scaglie di grana.' },
  { id: 's2', name: 'Filetto al Pepe Verde', price: 22, category: Category.SECONDI, description: 'Filetto di manzo tenero con salsa al pepe verde e panna.' },
  { id: 'd1', name: 'Tiramisù', price: 6, category: Category.DOLCI, description: 'Savoiardi, caffè, mascarpone, cacao amaro.' },
  { id: 'd2', name: 'Panna Cotta', price: 6, category: Category.DOLCI, description: 'Panna fresca, vaniglia, coulis di frutti di bosco.' },
  { id: 'b1', name: 'Acqua Naturale', price: 2, category: Category.BEVANDE },
  { id: 'b2', name: 'Vino Rosso della Casa', price: 10, category: Category.BEVANDE },
  { id: 'b3', name: 'Caffè Espresso', price: 1.5, category: Category.BEVANDE },
];