import { Trash2 } from 'lucide-react'

function ExpenseTable({ expenses, onExpenseChange, onDeleteExpense }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="w-full text-sm md:text-base">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <th className="px-3 md:px-4 py-3 text-left font-bold min-w-[140px]">Date</th>
            <th className="px-3 md:px-4 py-3 text-left font-bold min-w-[90px]">Receipt No</th>
            <th className="px-3 md:px-4 py-3 text-left font-bold min-w-[200px]">Description</th>
            <th className="px-3 md:px-4 py-3 text-center font-bold min-w-[110px]">Amount</th>
            <th className="px-3 md:px-4 py-3 text-center font-bold min-w-[90px]">Currency</th>
            <th className="px-3 md:px-4 py-3 text-right font-bold min-w-[115px]">Amount AED</th>
            <th className="px-3 md:px-4 py-3 text-center font-bold min-w-[60px]">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
          {expenses.map((expense, index) => (
            <tr 
              key={expense.id} 
              className={`transition-colors ${
                index % 2 === 0 
                  ? 'bg-white dark:bg-slate-900 hover:bg-blue-50/60 dark:hover:bg-slate-800/60' 
                  : 'bg-gray-50/80 dark:bg-slate-800/50 hover:bg-blue-100/60 dark:hover:bg-slate-800'
              }`}
            >
              <td className="px-3 md:px-4 py-3">
                <input
                  type="date"
                  value={expense.date}
                  onChange={(e) => onExpenseChange(expense.id, 'date', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="text"
                  value={expense.receiptNo}
                  onChange={(e) => onExpenseChange(expense.id, 'receiptNo', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="text"
                  value={expense.description}
                  onChange={(e) => onExpenseChange(expense.id, 'description', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="e.g., Fuel for Vehicle"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="number"
                  value={expense.amount}
                  onChange={(e) => onExpenseChange(expense.id, 'amount', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-center placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <select
                  value={expense.currency}
                  onChange={(e) => onExpenseChange(expense.id, 'currency', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm cursor-pointer"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="number"
                  value={expense.amountAED}
                  onChange={(e) => onExpenseChange(expense.id, 'amountAED', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-right font-semibold text-blue-600 dark:text-blue-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </td>
              <td className="px-3 md:px-4 py-3 text-center">
                <button
                  onClick={() => onDeleteExpense(expense.id)}
                  className="inline-flex items-center justify-center p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                  title="Delete this expense"
                >
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ExpenseTable
