import { Link } from 'react-router';
import { Logo } from '../ui/Logo';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center mb-4">
              <Logo tone="light" size={30} />
            </div>
            <p className="text-sm text-gray-400 max-w-md">
              The AI-native operating system for hospitality — ordering, payments,
              operations, and guests, for restaurants and hotels alike.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h3>
            <ul className="space-y-2">
              <li><Link to="/features" className="text-sm hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="text-sm hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/demo" className="text-sm hover:text-white transition-colors">Request Demo</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-sm hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="text-sm hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><Link to="/privacy" className="text-sm hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/cookies" className="text-sm hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link to="/refunds" className="text-sm hover:text-white transition-colors">Refunds</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Qlisted. All rights reserved.</p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Link to="/signin" className="text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-6 pt-6 text-center">
          <p className="text-sm text-gray-500">Designed and owned by Grand Minds Technology</p>
        </div>
      </div>
    </footer>
  );
}
