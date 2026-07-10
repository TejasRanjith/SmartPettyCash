# MANLIFT Expense Reimbursement App

A modern, interactive web application for managing expense reimbursement forms with a responsive design that works seamlessly on both desktop and mobile devices.

## Features

✨ **Modern Design**
- Clean, contemporary UI with gradient backgrounds
- Professional color scheme (Blue & Gold)
- Smooth animations and transitions

📱 **Fully Responsive**
- Optimized for mobile, tablet, and desktop
- Live preview with mobile and desktop viewing modes
- Touch-friendly interface

⚡ **Interactive Functionality**
- Real-time form editing
- Dynamic expense table management
- Add/remove expenses on the fly
- Automatic total calculation
- Export data as JSON

🎨 **User Experience**
- Intuitive form layout
- Clear visual hierarchy
- Accessible form controls
- Helpful placeholders and labels

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling framework
- **Lucide React** - Icon library

## Installation

1. Navigate to the project directory:
```bash
cd c:\Users\TejasRanjith\Desktop\SmartPettyCash
```

2. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm run dev
```

The app will automatically open in your browser at `http://localhost:3000`

## Building for Production

Build the application:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── ExpenseForm.jsx      # Form for entering employee details
│   ├── ExpenseTable.jsx     # Table for managing expenses
│   └── Header.jsx           # App header component
├── App.jsx                   # Main application component
├── main.jsx                  # Application entry point
└── index.css                 # Global styles

Public files:
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── postcss.config.js       # PostCSS configuration
```

## Usage

### Edit Mode
- Fill in employee information (Name, Date, Location, Position)
- Set the expense title and notes
- Add expenses by clicking "Add Expense"
- Edit each expense row with date, receipt number, description, amount, currency, and AED amount
- Delete expenses as needed
- The total is calculated automatically

### Preview Mode
- Switch to preview mode to see the formatted reimbursement form
- Choose between Desktop and Mobile view
- Mobile view shows a realistic phone frame display

### Export
- Click the "Export" button to download expense data as JSON
- Useful for storing records or integrating with other systems

## Customization

### Styling
Modify `tailwind.config.js` to customize colors:
```javascript
colors: {
  primary: '#FFD700',      // Gold for MANLIFT logo
  secondary: '#1e3a8a',    // Dark blue
}
```

### Adding Expense Categories
Extend the currency select options in `ExpenseTable.jsx` to add more currencies or expense types.

### Pre-filling Data
Modify the initial state in `App.jsx` to pre-populate the form with default values.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

This project is proprietary to MANLIFT.

## Support

For issues or questions, please contact the development team.
