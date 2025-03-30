import { Poppins } from 'next/font/google';
import Navbar from "@/components/Navbar";

// You can reuse the same Poppins font from the Navbar
const poppins = Poppins({
    subsets: ['latin'],
    weight: ['500', '600'],
    display: 'swap',
});

export default function AnexPage() {
    return (
        <div>
            <Navbar />
        </div>
    );
}