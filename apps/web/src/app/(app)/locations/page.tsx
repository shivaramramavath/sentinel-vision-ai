import { redirect } from 'next/navigation';

export default function LocationsRedirectPage() {
  redirect('/cameras?view=map');
}
