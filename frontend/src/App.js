import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { toast } from 'sonner';
import { Home, Building, Users, FileText, DollarSign, Calendar, Plus, Eye, Edit, Trash2, Search, Bell } from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// API functions
const api = {
  // Nekretnine
  getNekretnine: () => axios.get(`${API}/nekretnine`),
  createNekretnina: (data) => axios.post(`${API}/nekretnine`, data),
  updateNekretnina: (id, data) => axios.put(`${API}/nekretnine/${id}`, data),
  deleteNekretnina: (id) => axios.delete(`${API}/nekretnine/${id}`),
  
  // Zakupnici
  getZakupnici: () => axios.get(`${API}/zakupnici`),
  createZakupnik: (data) => axios.post(`${API}/zakupnici`, data),
  
  // Ugovori
  getUgovori: () => axios.get(`${API}/ugovori`),
  createUgovor: (data) => axios.post(`${API}/ugovori`, data),
  updateStatusUgovora: (id, status) => axios.put(`${API}/ugovori/${id}/status`, { novi_status: status }),
  
  // Dokumenti
  getDokumenti: () => axios.get(`${API}/dokumenti`),
  getDokumentiNekretnine: (id) => axios.get(`${API}/dokumenti/nekretnina/${id}`),
  getDokumentiZakupnika: (id) => axios.get(`${API}/dokumenti/zakupnik/${id}`),
  getDokumentiUgovora: (id) => axios.get(`${API}/dokumenti/ugovor/${id}`),
  createDokument: (data) => axios.post(`${API}/dokumenti`, data),
  
  // Dashboard i pretraga
  getDashboard: () => axios.get(`${API}/dashboard`),
  pretraga: (q) => axios.get(`${API}/pretraga?q=${q}`),
  
  // Podsjećanja
  getPodsjetnici: () => axios.get(`${API}/podsjetnici`),
  getAktivniPodsjetnici: () => axios.get(`${API}/podsjetnici/aktivni`),
  
  // AI PDF parsing
  parsePdfContract: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/ai/parse-pdf-contract`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Navigation Component
const Navigation = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/nekretnine', icon: Building, label: 'Nekretnine' },
    { path: '/zakupnici', icon: Users, label: 'Zakupnici' },
    { path: '/ugovori', icon: Calendar, label: 'Ugovori' },
    { path: '/dokumenti', icon: FileText, label: 'Dokumenti' },
    { path: '/podsjetnici', icon: Bell, label: 'Podsjećanja' }
  ];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      try {
        const response = await api.pretraga(searchQuery);
        setSearchResults(response.data);
        toast.success(`Pronađeno ${Object.values(response.data).flat().length} rezultata`);
      } catch (error) {
        console.error('Greška pri pretraživanju:', error);
        toast.error('Greška pri pretraživanju');
      }
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-gray-900">Upravljanje nekretninama</h1>
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        
        <form onSubmit={handleSearch} className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Pretraži nekretnine, zakupnike, ugovore..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80"
            data-testid="search-input"
          />
          <Button type="submit" variant="outline" size="sm" data-testid="search-button">
            <Search className="w-4 h-4" />
          </Button>
        </form>
      </div>
      
      {searchResults && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Rezultati pretrage:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-sm text-gray-600">Nekretnine ({searchResults.nekretnine?.length || 0})</h4>
              {searchResults.nekretnine?.map(n => (
                <p key={n.id} className="text-sm">{n.naziv} - {n.adresa}</p>
              ))}
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-600">Zakupnici ({searchResults.zakupnici?.length || 0})</h4>
              {searchResults.zakupnici?.map(z => (
                <p key={z.id} className="text-sm">{z.naziv_firme || z.ime_prezime} - {z.oib}</p>
              ))}
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-600">Ugovori ({searchResults.ugovori?.length || 0})</h4>
              {searchResults.ugovori?.map(u => (
                <p key={u.id} className="text-sm">{u.interna_oznaka} - {u.status}</p>
              ))}
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSearchResults(null)}
            className="mt-2"
          >
            Zatvori
          </Button>
        </div>
      )}
    </nav>
  );
};

// Clickable Reminder Component
const ClickableReminder = ({ podsjetnik }) => {
  const navigate = useNavigate();
  const [ugovorDetails, setUgovorDetails] = useState(null);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);

  useEffect(() => {
    fetchUgovorDetails();
  }, []);

  const fetchUgovorDetails = async () => {
    try {
      const [ugovorRes, nekretnineRes, zakupniciRes] = await Promise.all([
        api.getUgovori(),
        api.getNekretnine(), 
        api.getZakupnici()
      ]);
      
      const ugovor = ugovorRes.data.find(u => u.id === podsjetnik.ugovor_id);
      const nekretnina = nekretnineRes.data.find(n => n.id === ugovor?.nekretnina_id);
      const zakupnik = zakupniciRes.data.find(z => z.id === ugovor?.zakupnik_id);
      
      setUgovorDetails({ ugovor, nekretnina, zakupnik });
    } catch (error) {
      console.error('Greška pri dohvaćanju detalja ugovora:', error);
    }
  };

  const handleReminderClick = () => {
    if (podsjetnik.tip === 'istek_ugovora') {
      setShowRenewalDialog(true);
    }
  };

  const handleRenewContract = async (godina) => {
    try {
      if (!ugovorDetails?.ugovor) return;
      
      const trenutniUgovor = ugovorDetails.ugovor;
      const noviDatumPocetka = new Date(trenutniUgovor.datum_zavrsetka);
      const noviDatumZavrsetka = new Date(trenutniUgovor.datum_zavrsetka);
      noviDatumZavrsetka.setFullYear(noviDatumZavrsetka.getFullYear() + godina);
      
      // Pripremi podatke za novi ugovor i otvori formu
      const noviUgovorTemplate = {
        interna_oznaka: `${trenutniUgovor.interna_oznaka}-PROD-${godina}G`,
        nekretnina_id: trenutniUgovor.nekretnina_id,
        zakupnik_id: trenutniUgovor.zakupnik_id,
        datum_potpisivanja: new Date().toISOString().split('T')[0],
        datum_pocetka: noviDatumPocetka.toISOString().split('T')[0],
        datum_zavrsetka: noviDatumZavrsetka.toISOString().split('T')[0],
        trajanje_mjeseci: godina * 12,
        opcija_produljenja: trenutniUgovor.opcija_produljenja,
        uvjeti_produljenja: trenutniUgovor.uvjeti_produljenja,
        rok_otkaza_dani: trenutniUgovor.rok_otkaza_dani,
        osnovna_zakupnina: trenutniUgovor.osnovna_zakupnina * (1 + 0.03 * godina), // 3% godišnje povećanje
        zakupnina_po_m2: trenutniUgovor.zakupnina_po_m2 ? trenutniUgovor.zakupnina_po_m2 * (1 + 0.03 * godina) : null,
        cam_troskovi: trenutniUgovor.cam_troskovi,
        polog_depozit: trenutniUgovor.polog_depozit,
        garancija: trenutniUgovor.garancija,
        indeksacija: trenutniUgovor.indeksacija,
        indeks: trenutniUgovor.indeks,
        formula_indeksacije: trenutniUgovor.formula_indeksacije,
        obveze_odrzavanja: trenutniUgovor.obveze_odrzavanja,
        namjena_prostora: trenutniUgovor.namjena_prostora,
        rezije_brojila: trenutniUgovor.rezije_brojila,
        _isRenewal: true,
        _oldContractId: trenutniUgovor.id
      };
      
      // Spremi template u sessionStorage i preusmjeri
      sessionStorage.setItem('renewalTemplate', JSON.stringify(noviUgovorTemplate));
      setShowRenewalDialog(false);
      navigate('/ugovori?action=renew');
    } catch (error) {
      console.error('Greška pri pripremi produška ugovora:', error);
      toast.error('Greška pri pripremi produžetka ugovora');
    }
  };

  if (!ugovorDetails) {
    return (
      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
        <div>
          <p className="font-medium">Učitava podsjećanje...</p>
        </div>
        <Badge variant="secondary">Učitava</Badge>
      </div>
    );
  }

  const getPriorityColor = (dani) => {
    if (dani <= 30) return 'bg-red-100 border-red-200 hover:bg-red-200';
    if (dani <= 60) return 'bg-orange-100 border-orange-200 hover:bg-orange-200';
    return 'bg-yellow-100 border-yellow-200 hover:bg-yellow-200';
  };

  const getPriorityBadge = (dani) => {
    if (dani <= 30) return <Badge variant="destructive">Hitno</Badge>;
    if (dani <= 60) return <Badge variant="secondary" className="bg-orange-200 text-orange-800">Srednje</Badge>;
    return <Badge variant="outline">Informativno</Badge>;
  };

  return (
    <>
      <div 
        className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${getPriorityColor(podsjetnik.dani_prije)}`}
        onClick={handleReminderClick}
        data-testid={`clickable-reminder-${podsjetnik.id}`}
      >
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="font-bold text-gray-900">
              {podsjetnik.tip === 'istek_ugovora' ? 'ISTEK UGOVORA' : podsjetnik.tip.toUpperCase()}
            </h4>
            {getPriorityBadge(podsjetnik.dani_prije)}
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-600">
              📋 {ugovorDetails.ugovor?.interna_oznaka}
            </p>
            <p className="text-sm text-gray-700">
              🏢 {ugovorDetails.nekretnina?.naziv} - {ugovorDetails.nekretnina?.adresa}
            </p>
            <p className="text-sm text-gray-700">
              👤 {ugovorDetails.zakupnik?.naziv_firme || ugovorDetails.zakupnik?.ime_prezime}
            </p>
            <p className="text-sm text-gray-600">
              📅 Ističe: {new Date(ugovorDetails.ugovor?.datum_zavrsetka).toLocaleDateString()} 
              <span className="font-medium text-red-600 ml-2">
                (za {podsjetnik.dani_prije} dana)
              </span>
            </p>
            <p className="text-sm text-green-600 font-medium">
              💰 {ugovorDetails.ugovor?.osnovna_zakupnina?.toLocaleString()} €/mjesec
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-2">Kliknite za akciju</div>
          <Button 
            variant="default" 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              handleReminderClick();
            }}
          >
            Riješi →
          </Button>
        </div>
      </div>

      {/* Renewal Dialog */}
      <Dialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="renewal-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Produžetak ugovora - {ugovorDetails.ugovor?.interna_oznaka}
            </DialogTitle>
          </DialogHeader>
          <div id="renewal-dialog-description" className="sr-only">
            Dialog za produžetak ugovora s opcijama 1, 2 ili 5 godina
          </div>

          <div className="space-y-6">
            {/* Contract details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Detalji trenutnog ugovora:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Nekretnina:</span> {ugovorDetails.nekretnina?.naziv}
                </div>
                <div>
                  <span className="font-medium">Zakupnik:</span> {ugovorDetails.zakupnik?.naziv_firme || ugovorDetails.zakupnik?.ime_prezime}
                </div>
                <div>
                  <span className="font-medium">Trenutna kirija:</span> {ugovorDetails.ugovor?.osnovna_zakupnina?.toLocaleString()} €
                </div>
                <div>
                  <span className="font-medium">Ističe:</span> {new Date(ugovorDetails.ugovor?.datum_zavrsetka).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Renewal options */}
            <div>
              <h3 className="font-medium mb-4">Izaberite opciju produžetka:</h3>
              <div className="grid grid-cols-1 gap-3">
                
                <Card 
                  className="cursor-pointer hover:bg-blue-50 border-2 hover:border-blue-300 transition-all"
                  onClick={() => handleRenewContract(1)}
                  data-testid="renewal-option-1-year"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg">1 Godina</h4>
                        <p className="text-sm text-gray-600">
                          Nova kirija: {((ugovorDetails.ugovor?.osnovna_zakupnina || 0) * 1.03).toLocaleString()} €/mjesec
                        </p>
                        <p className="text-xs text-gray-500">Povećanje: 3% (standardno)</p>
                      </div>
                      <Badge variant="default">Standardno</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:bg-green-50 border-2 hover:border-green-300 transition-all"
                  onClick={() => handleRenewContract(2)}
                  data-testid="renewal-option-2-years"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg">2 Godine</h4>
                        <p className="text-sm text-gray-600">
                          Nova kirija: {((ugovorDetails.ugovor?.osnovna_zakupnina || 0) * 1.06).toLocaleString()} €/mjesec
                        </p>
                        <p className="text-xs text-gray-500">Povećanje: 6% (3% godišnje x 2)</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-200 text-green-800">Preporučeno</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:bg-purple-50 border-2 hover:border-purple-300 transition-all"
                  onClick={() => handleRenewContract(5)}
                  data-testid="renewal-option-5-years"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg">5 Godina</h4>
                        <p className="text-sm text-gray-600">
                          Nova kirija: {((ugovorDetails.ugovor?.osnovna_zakupnina || 0) * 1.15).toLocaleString()} €/mjesec
                        </p>
                        <p className="text-xs text-gray-500">Povećanje: 15% (3% godišnje x 5)</p>
                      </div>
                      <Badge variant="outline" className="border-purple-300 text-purple-700">Dugoročno</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowRenewalDialog(false)}
                className="flex-1"
                data-testid="cancel-renewal"
              >
                Otkaži
              </Button>
              <Button 
                variant="default"
                onClick={() => navigate('/ugovori')}
                className="flex-1"
                data-testid="go-to-contracts"
              >
                Idi na ugovore
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [podsjetnici, setPodsjetnici] = useState([]);

  useEffect(() => {
    fetchDashboard();
    fetchPodsjetnici();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju dashboard podataka:', error);
      toast.error('Greška pri učitavanju dashboard-a');
    }
  };

  const fetchPodsjetnici = async () => {
    try {
      const response = await api.getAktivniPodsjetnici();
      setPodsjetnici(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju podsjećanja:', error);
    }
  };

  if (!dashboard) {
    return <div className="p-8">Učitava...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card data-testid="ukupno-nekretnina-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupno nekretnina</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.ukupno_nekretnina}</div>
          </CardContent>
        </Card>

        <Card data-testid="aktivni-ugovori-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktivni ugovori</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.aktivni_ugovori}</div>
          </CardContent>
        </Card>

        <Card data-testid="ugovori-na-isteku-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ugovori na isteku</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.ugovori_na_isteku}</div>
          </CardContent>
        </Card>

        <Card data-testid="aktivni-podsjetnici-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktivna podsjećanja</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.aktivni_podsjetnici}</div>
          </CardContent>
        </Card>

        <Card data-testid="mjesecni-prihod-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mjesečni prihod</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.mjesecni_prihod?.toLocaleString()} €</div>
          </CardContent>
        </Card>
      </div>

      {podsjetnici.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aktivna podsjećanja - Potrebne akcije</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {podsjetnici.slice(0, 5).map((podsjetnik) => (
                <ClickableReminder 
                  key={podsjetnik.id} 
                  podsjetnik={podsjetnik}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Nekretnine Component
const Nekretnine = () => {
  const [nekretnine, setNekretnine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNekretnina, setEditingNekretnina] = useState(null);

  useEffect(() => {
    fetchNekretnine();
  }, []);

  const fetchNekretnine = async () => {
    try {
      const response = await api.getNekretnine();
      setNekretnine(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju nekretnina:', error);
      toast.error('Greška pri učitavanju nekretnina');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNekretnina = async (formData) => {
    try {
      await api.createNekretnina(formData);
      toast.success('Nekretnina je uspješno kreirana');
      fetchNekretnine();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju nekretnine:', error);
      toast.error('Greška pri kreiranju nekretnine');
    }
  };

  const handleUpdateNekretnina = async (formData) => {
    try {
      await api.updateNekretnina(editingNekretnina.id, formData);
      toast.success('Nekretnina je uspješno ažurirana');
      fetchNekretnine();
      setEditingNekretnina(null);
    } catch (error) {
      console.error('Greška pri ažuriranju nekretnine:', error);
      toast.error('Greška pri ažuriranju nekretnine');
    }
  };

  const handleDeleteNekretnina = async (nekretnina_id) => {
    if (window.confirm('Jeste li sigurni da želite obrisati ovu nekretninu?')) {
      try {
        await api.deleteNekretnina(nekretnina_id);
        toast.success('Nekretnina je uspješno obrisana');
        fetchNekretnine();
      } catch (error) {
        console.error('Greška pri brisanju nekretnine:', error);
        toast.error('Greška pri brisanju nekretnine');
      }
    }
  };

  const generatePropertyReport = async (nekretnina) => {
    try {
      toast.info('Generiranje PDF analize...');
      
      // Kreiraj novi PDF dokument
      const doc = new jsPDF();
      
      // Dodaj naslov
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('ANALIZA NEKRETNINE', 105, 20, { align: 'center' });
      
      // Dodaj liniju
      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);
      
      // Osnovni podaci
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('OSNOVNI PODACI', 20, 40);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Naziv: ${nekretnina.naziv}`, 20, 50);
      doc.text(`Adresa: ${nekretnina.adresa}`, 20, 58);
      doc.text(`Katastarska opcina: ${nekretnina.katastarska_opcina}`, 20, 66);
      doc.text(`Broj kat. cestice: ${nekretnina.broj_kat_cestice}`, 20, 74);
      doc.text(`Vrsta: ${nekretnina.vrsta.replace('_', ' ').toUpperCase()}`, 20, 82);
      doc.text(`Povrsina: ${nekretnina.povrsina} m²`, 20, 90);
      if (nekretnina.godina_izgradnje) {
        doc.text(`Godina izgradnje: ${nekretnina.godina_izgradnje}`, 20, 98);
      }
      
      // Vlasništvo
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('VLASNIŠTVO', 20, 115);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vlasnik: ${nekretnina.vlasnik}`, 20, 125);
      doc.text(`Udio vlasništva: ${nekretnina.udio_vlasnistva}`, 20, 133);
      
      // Financijska analiza
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIJSKA ANALIZA', 20, 150);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      let yPos = 160;
      
      if (nekretnina.nabavna_cijena) {
        doc.text(`Nabavna cijena: ${nekretnina.nabavna_cijena.toLocaleString()} EUR`, 20, yPos);
        yPos += 8;
      }
      
      if (nekretnina.trzisna_vrijednost) {
        doc.text(`Tržišna vrijednost: ${nekretnina.trzisna_vrijednost.toLocaleString()} EUR`, 20, yPos);
        yPos += 8;
        
        // Izračunaj odnos tržišne i nabavne cijene
        if (nekretnina.nabavna_cijena) {
          const razlika = nekretnina.trzisna_vrijednost - nekretnina.nabavna_cijena;
          const postotak = ((razlika / nekretnina.nabavna_cijena) * 100).toFixed(2);
          doc.text(`Promjena vrijednosti: ${razlika.toLocaleString()} EUR (${postotak}%)`, 20, yPos);
          yPos += 8;
        }
      }
      
      if (nekretnina.prosllogodisnji_prihodi) {
        doc.text(`Prošlogodišnji prihodi: ${nekretnina.prosllogodisnji_prihodi.toLocaleString()} EUR`, 20, yPos);
        yPos += 8;
      }
      
      if (nekretnina.prosllogodisnji_rashodi) {
        doc.text(`Prošlogodišnji rashodi: ${nekretnina.prosllogodisnji_rashodi.toLocaleString()} EUR`, 20, yPos);
        yPos += 8;
      }
      
      if (nekretnina.neto_prihod) {
        doc.text(`Neto prihod: ${nekretnina.neto_prihod.toLocaleString()} EUR`, 20, yPos);
        yPos += 8;
        
        // Izračunaj prinos na investiciju
        if (nekretnina.nabavna_cijena && nekretnina.nabavna_cijena > 0) {
          const prinos = ((nekretnina.neto_prihod / nekretnina.nabavna_cijena) * 100).toFixed(2);
          doc.text(`Prinos na investiciju: ${prinos}%`, 20, yPos);
          yPos += 8;
        }
      }
      
      if (nekretnina.amortizacija) {
        doc.text(`Amortizacija: ${nekretnina.amortizacija.toLocaleString()} EUR`, 20, yPos);
        yPos += 8;
      }
      
      // Održavanje i rizici
      if (nekretnina.troskovi_odrzavanja || nekretnina.potrebna_ulaganja || nekretnina.osiguranje) {
        yPos += 10;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('ODRŽAVANJE', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        if (nekretnina.troskovi_odrzavanja) {
          doc.text(`Troškovi održavanja: ${nekretnina.troskovi_odrzavanja.toLocaleString()} EUR`, 20, yPos);
          yPos += 8;
        }
        
        if (nekretnina.zadnja_obnova) {
          doc.text(`Zadnja obnova: ${new Date(nekretnina.zadnja_obnova).toLocaleDateString()}`, 20, yPos);
          yPos += 8;
        }
        
        if (nekretnina.potrebna_ulaganja) {
          doc.text(`Potrebna ulaganja: ${nekretnina.potrebna_ulaganja}`, 20, yPos);
          yPos += 8;
        }
        
        if (nekretnina.osiguranje) {
          doc.text(`Osiguranje: ${nekretnina.osiguranje}`, 20, yPos);
          yPos += 8;
        }
      }
      
      // Rizici i napomene
      if (nekretnina.sudski_sporovi || nekretnina.hipoteke || nekretnina.napomene) {
        yPos += 10;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('RIZICI I NAPOMENE', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        if (nekretnina.sudski_sporovi) {
          const lines = doc.splitTextToSize(`Sudski sporovi: ${nekretnina.sudski_sporovi}`, 170);
          doc.text(lines, 20, yPos);
          yPos += lines.length * 6 + 2;
        }
        
        if (nekretnina.hipoteke) {
          const lines = doc.splitTextToSize(`Hipoteke: ${nekretnina.hipoteke}`, 170);
          doc.text(lines, 20, yPos);
          yPos += lines.length * 6 + 2;
        }
        
        if (nekretnina.napomene) {
          const lines = doc.splitTextToSize(`Napomene: ${nekretnina.napomene}`, 170);
          doc.text(lines, 20, yPos);
        }
      }
      
      // Dodaj datum generiranja
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(`Izvješće generirano: ${new Date().toLocaleString()}`, 20, 280);
      
      // Spremi PDF
      const fileName = `Analiza_${nekretnina.naziv.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success(`PDF analiza za ${nekretnina.naziv} je uspješno generirana`);
    } catch (error) {
      console.error('Greška pri generiranju PDF analize:', error);
      toast.error('Greška pri generiranju PDF analize');
    }
  };

  if (loading) {
    return <div className="p-8">Učitava nekretnine...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Nekretnine</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="dodaj-nekretninu-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj nekretninu
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nekretnine.map((nekretnina) => (
          <Card key={nekretnina.id} data-testid={`nekretnina-card-${nekretnina.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {nekretnina.naziv}
                <Badge variant="outline">
                  {nekretnina.vrsta.replace('_', ' ').toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">{nekretnina.adresa}</p>
              <p className="text-sm">
                <span className="font-medium">K.O.:</span> {nekretnina.katastarska_opcina}
              </p>
              <p className="text-sm">
                <span className="font-medium">Kat. čestica:</span> {nekretnina.broj_kat_cestice}
              </p>
              <p className="text-sm">
                <span className="font-medium">Površina:</span> {nekretnina.povrsina}m²
              </p>
              <p className="text-sm">
                <span className="font-medium">Vlasnik:</span> {nekretnina.vlasnik} ({nekretnina.udio_vlasnistva})
              </p>
              {nekretnina.trzisna_vrijednost && (
                <p className="text-lg font-bold text-green-600">
                  Tržišna vrijednost: {nekretnina.trzisna_vrijednost.toLocaleString()} €
                </p>
              )}
              <div className="flex space-x-1 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingNekretnina(nekretnina)}
                  data-testid={`uredi-nekretninu-${nekretnina.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDeleteNekretnina(nekretnina.id)}
                  data-testid={`obrisi-nekretninu-${nekretnina.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => generatePropertyReport(nekretnina)}
                  data-testid={`pdf-analiza-${nekretnina.id}`}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Nekretnina Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="nekretnina-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj novu nekretninu</DialogTitle>
          </DialogHeader>
          <div id="nekretnina-form-description" className="sr-only">
            Forma za kreiranje nove nekretnine s osnovnim informacijama
          </div>
          <NekretninarForm 
            onSubmit={handleCreateNekretnina}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Nekretnina Dialog */}
      <Dialog open={!!editingNekretnina} onOpenChange={() => setEditingNekretnina(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="uredi-nekretninu-form-description">
          <DialogHeader>
            <DialogTitle>Uredi nekretninu</DialogTitle>
          </DialogHeader>
          <div id="uredi-nekretninu-form-description" className="sr-only">
            Forma za uređivanje postojeće nekretnine
          </div>
          <NekretninarForm 
            nekretnina={editingNekretnina}
            onSubmit={handleUpdateNekretnina}
            onCancel={() => setEditingNekretnina(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Nekretnina Form Component
const NekretninarForm = ({ nekretnina, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    naziv: nekretnina?.naziv || '',
    adresa: nekretnina?.adresa || '',
    katastarska_opcina: nekretnina?.katastarska_opcina || '',
    broj_kat_cestice: nekretnina?.broj_kat_cestice || '',
    vrsta: nekretnina?.vrsta || 'stan',
    povrsina: nekretnina?.povrsina || '',
    godina_izgradnje: nekretnina?.godina_izgradnje || '',
    vlasnik: nekretnina?.vlasnik || '',
    udio_vlasnistva: nekretnina?.udio_vlasnistva || '',
    nabavna_cijena: nekretnina?.nabavna_cijena || '',
    trzisna_vrijednost: nekretnina?.trzisna_vrijednost || '',
    prosllogodisnji_prihodi: nekretnina?.prosllogodisnji_prihodi || '',
    prosllogodisnji_rashodi: nekretnina?.prosllogodisnji_rashodi || '',
    amortizacija: nekretnina?.amortizacija || '',
    neto_prihod: nekretnina?.neto_prihod || '',
    zadnja_obnova: nekretnina?.zadnja_obnova || '',
    potrebna_ulaganja: nekretnina?.potrebna_ulaganja || '',
    troskovi_odrzavanja: nekretnina?.troskovi_odrzavanja || '',
    osiguranje: nekretnina?.osiguranje || '',
    sudski_sporovi: nekretnina?.sudski_sporovi || '',
    hipoteke: nekretnina?.hipoteke || '',
    napomene: nekretnina?.napomene || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      povrsina: parseFloat(formData.povrsina) || 0,
      godina_izgradnje: formData.godina_izgradnje ? parseInt(formData.godina_izgradnje) : null,
      nabavna_cijena: formData.nabavna_cijena ? parseFloat(formData.nabavna_cijena) : null,
      trzisna_vrijednost: formData.trzisna_vrijednost ? parseFloat(formData.trzisna_vrijednost) : null,
      prosllogodisnji_prihodi: formData.prosllogodisnji_prihodi ? parseFloat(formData.prosllogodisnji_prihodi) : null,
      prosllogodisnji_rashodi: formData.prosllogodisnji_rashodi ? parseFloat(formData.prosllogodisnji_rashodi) : null,
      amortizacija: formData.amortizacija ? parseFloat(formData.amortizacija) : null,
      neto_prihod: formData.neto_prihod ? parseFloat(formData.neto_prihod) : null,
      troskovi_odrzavanja: formData.troskovi_odrzavanja ? parseFloat(formData.troskovi_odrzavanja) : null,
      zadnja_obnova: formData.zadnja_obnova || null
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="nekretnina-form">
      <Tabs defaultValue="osnovni" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="osnovni">Osnovni podaci</TabsTrigger>
          <TabsTrigger value="financije">Financije</TabsTrigger>
          <TabsTrigger value="odrzavanje">Održavanje</TabsTrigger>
          <TabsTrigger value="rizici">Rizici</TabsTrigger>
        </TabsList>
        
        <TabsContent value="osnovni" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="naziv">Naziv nekretnine *</Label>
              <Input
                id="naziv"
                value={formData.naziv}
                onChange={(e) => setFormData({ ...formData, naziv: e.target.value })}
                data-testid="nekretnina-naziv-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="vrsta">Vrsta nekretnine *</Label>
              <Select value={formData.vrsta} onValueChange={(value) => setFormData({ ...formData, vrsta: value })}>
                <SelectTrigger data-testid="nekretnina-vrsta-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poslovna_zgrada">Poslovna zgrada</SelectItem>
                  <SelectItem value="stan">Stan</SelectItem>
                  <SelectItem value="zemljiste">Zemljište</SelectItem>
                  <SelectItem value="ostalo">Ostalo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="adresa">Adresa *</Label>
            <Input
              id="adresa"
              value={formData.adresa}
              onChange={(e) => setFormData({ ...formData, adresa: e.target.value })}
              data-testid="nekretnina-adresa-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="katastarska_opcina">Katastarska općina *</Label>
              <Input
                id="katastarska_opcina"
                value={formData.katastarska_opcina}
                onChange={(e) => setFormData({ ...formData, katastarska_opcina: e.target.value })}
                data-testid="nekretnina-ko-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="broj_kat_cestice">Broj kat. čestice *</Label>
              <Input
                id="broj_kat_cestice"
                value={formData.broj_kat_cestice}
                onChange={(e) => setFormData({ ...formData, broj_kat_cestice: e.target.value })}
                data-testid="nekretnina-cestica-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="povrsina">Površina (m²) *</Label>
              <Input
                id="povrsina"
                type="number"
                step="0.01"
                value={formData.povrsina}
                onChange={(e) => setFormData({ ...formData, povrsina: e.target.value })}
                data-testid="nekretnina-povrsina-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="godina_izgradnje">Godina izgradnje</Label>
              <Input
                id="godina_izgradnje"
                type="number"
                value={formData.godina_izgradnje}
                onChange={(e) => setFormData({ ...formData, godina_izgradnje: e.target.value })}
                data-testid="nekretnina-godina-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vlasnik">Vlasnik *</Label>
              <Input
                id="vlasnik"
                value={formData.vlasnik}
                onChange={(e) => setFormData({ ...formData, vlasnik: e.target.value })}
                data-testid="nekretnina-vlasnik-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="udio_vlasnistva">Udio vlasništva *</Label>
              <Input
                id="udio_vlasnistva"
                value={formData.udio_vlasnistva}
                onChange={(e) => setFormData({ ...formData, udio_vlasnistva: e.target.value })}
                data-testid="nekretnina-udio-input"
                placeholder="npr. 1/1, 50%, itd."
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financije" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nabavna_cijena">Nabavna cijena (€)</Label>
              <Input
                id="nabavna_cijena"
                type="number"
                step="0.01"
                value={formData.nabavna_cijena}
                onChange={(e) => setFormData({ ...formData, nabavna_cijena: e.target.value })}
                data-testid="nekretnina-nabavna-input"
              />
            </div>
            <div>
              <Label htmlFor="trzisna_vrijednost">Tržišna vrijednost (€)</Label>
              <Input
                id="trzisna_vrijednost"
                type="number"
                step="0.01"
                value={formData.trzisna_vrijednost}
                onChange={(e) => setFormData({ ...formData, trzisna_vrijednost: e.target.value })}
                data-testid="nekretnina-trzisna-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prosllogodisnji_prihodi">Prošlogodišnji prihodi (€)</Label>
              <Input
                id="prosllogodisnji_prihodi"
                type="number"
                step="0.01"
                value={formData.prosllogodisnji_prihodi}
                onChange={(e) => setFormData({ ...formData, prosllogodisnji_prihodi: e.target.value })}
                data-testid="nekretnina-prihodi-input"
              />
            </div>
            <div>
              <Label htmlFor="prosllogodisnji_rashodi">Prošlogodišnji rashodi (€)</Label>
              <Input
                id="prosllogodisnji_rashodi"
                type="number"
                step="0.01"
                value={formData.prosllogodisnji_rashodi}
                onChange={(e) => setFormData({ ...formData, prosllogodisnji_rashodi: e.target.value })}
                data-testid="nekretnina-rashodi-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amortizacija">Amortizacija (€)</Label>
              <Input
                id="amortizacija"
                type="number"
                step="0.01"
                value={formData.amortizacija}
                onChange={(e) => setFormData({ ...formData, amortizacija: e.target.value })}
                data-testid="nekretnina-amortizacija-input"
              />
            </div>
            <div>
              <Label htmlFor="neto_prihod">Neto prihod (€)</Label>
              <Input
                id="neto_prihod"
                type="number"
                step="0.01"
                value={formData.neto_prihod}
                onChange={(e) => setFormData({ ...formData, neto_prihod: e.target.value })}
                data-testid="nekretnina-neto-input"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="odrzavanje" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zadnja_obnova">Zadnja obnova</Label>
              <Input
                id="zadnja_obnova"
                type="date"
                value={formData.zadnja_obnova}
                onChange={(e) => setFormData({ ...formData, zadnja_obnova: e.target.value })}
                data-testid="nekretnina-obnova-input"
              />
            </div>
            <div>
              <Label htmlFor="troskovi_odrzavanja">Troškovi održavanja (€)</Label>
              <Input
                id="troskovi_odrzavanja"
                type="number"
                step="0.01"
                value={formData.troskovi_odrzavanja}
                onChange={(e) => setFormData({ ...formData, troskovi_odrzavanja: e.target.value })}
                data-testid="nekretnina-troskovi-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="potrebna_ulaganja">Potrebna ulaganja</Label>
            <Textarea
              id="potrebna_ulaganja"
              value={formData.potrebna_ulaganja}
              onChange={(e) => setFormData({ ...formData, potrebna_ulaganja: e.target.value })}
              data-testid="nekretnina-ulaganja-input"
            />
          </div>

          <div>
            <Label htmlFor="osiguranje">Osiguranje</Label>
            <Input
              id="osiguranje"
              value={formData.osiguranje}
              onChange={(e) => setFormData({ ...formData, osiguranje: e.target.value })}
              data-testid="nekretnina-osiguranje-input"
            />
          </div>
        </TabsContent>

        <TabsContent value="rizici" className="space-y-4">
          <div>
            <Label htmlFor="sudski_sporovi">Sudski sporovi</Label>
            <Textarea
              id="sudski_sporovi"
              value={formData.sudski_sporovi}
              onChange={(e) => setFormData({ ...formData, sudski_sporovi: e.target.value })}
              data-testid="nekretnina-sporovi-input"
            />
          </div>

          <div>
            <Label htmlFor="hipoteke">Hipoteke</Label>
            <Textarea
              id="hipoteke"
              value={formData.hipoteke}
              onChange={(e) => setFormData({ ...formData, hipoteke: e.target.value })}
              data-testid="nekretnina-hipoteke-input"
            />
          </div>

          <div>
            <Label htmlFor="napomene">Napomene</Label>
            <Textarea
              id="napomene"
              value={formData.napomene}
              onChange={(e) => setFormData({ ...formData, napomene: e.target.value })}
              data-testid="nekretnina-napomene-input"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex space-x-2 pt-4">
        <Button type="submit" data-testid="potvrdi-nekretninu-form">
          {nekretnina ? 'Ažuriraj' : 'Kreiraj'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-nekretninu-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Zakupnici Component
const Zakupnici = () => {
  const [zakupnici, setZakupnici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchZakupnici();
  }, []);

  const fetchZakupnici = async () => {
    try {
      const response = await api.getZakupnici();
      setZakupnici(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju zakupnika:', error);
      toast.error('Greška pri učitavanju zakupnika');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZakupnik = async (formData) => {
    try {
      await api.createZakupnik(formData);
      toast.success('Zakupnik je uspješno kreiran');
      fetchZakupnici();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju zakupnika:', error);
      toast.error('Greška pri kreiranju zakupnika');
    }
  };

  if (loading) {
    return <div className="p-8">Učitava zakupnike...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Zakupnici</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="dodaj-zakupnika-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj zakupnika
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zakupnici.map((zakupnik) => (
          <Card key={zakupnik.id} data-testid={`zakupnik-card-${zakupnik.id}`}>
            <CardHeader>
              <CardTitle>{zakupnik.naziv_firme || zakupnik.ime_prezime}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">OIB:</span> {zakupnik.oib}
              </p>
              <p className="text-sm">
                <span className="font-medium">Sjedište:</span> {zakupnik.sjediste}
              </p>
              <p className="text-sm">
                <span className="font-medium">Kontakt:</span> {zakupnik.kontakt_ime}
              </p>
              <p className="text-sm">
                <span className="font-medium">Email:</span> {zakupnik.kontakt_email}
              </p>
              <p className="text-sm">
                <span className="font-medium">Telefon:</span> {zakupnik.kontakt_telefon}
              </p>
              {zakupnik.iban && (
                <p className="text-sm">
                  <span className="font-medium">IBAN:</span> {zakupnik.iban}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Zakupnik Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent aria-describedby="zakupnik-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj novog zakupnika</DialogTitle>
          </DialogHeader>
          <div id="zakupnik-form-description" className="sr-only">
            Forma za kreiranje novog zakupnika s osnovnim informacijama
          </div>
          <ZakupnikForm 
            onSubmit={handleCreateZakupnik}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Zakupnik Form Component
const ZakupnikForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    naziv_firme: '',
    ime_prezime: '',
    oib: '',
    sjediste: '',
    kontakt_ime: '',
    kontakt_email: '',
    kontakt_telefon: '',
    iban: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      naziv_firme: formData.naziv_firme || null,
      ime_prezime: formData.ime_prezime || null,
      iban: formData.iban || null
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="zakupnik-form">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="naziv_firme">Naziv firme</Label>
          <Input
            id="naziv_firme"
            value={formData.naziv_firme}
            onChange={(e) => setFormData({ ...formData, naziv_firme: e.target.value })}
            data-testid="zakupnik-naziv-input"
          />
        </div>
        <div>
          <Label htmlFor="ime_prezime">Ime i prezime</Label>
          <Input
            id="ime_prezime"
            value={formData.ime_prezime}
            onChange={(e) => setFormData({ ...formData, ime_prezime: e.target.value })}
            data-testid="zakupnik-ime-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="oib">OIB / VAT ID *</Label>
          <Input
            id="oib"
            value={formData.oib}
            onChange={(e) => setFormData({ ...formData, oib: e.target.value })}
            data-testid="zakupnik-oib-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            value={formData.iban}
            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
            data-testid="zakupnik-iban-input"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="sjediste">Sjedište / adresa *</Label>
        <Input
          id="sjediste"
          value={formData.sjediste}
          onChange={(e) => setFormData({ ...formData, sjediste: e.target.value })}
          data-testid="zakupnik-sjediste-input"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="kontakt_ime">Kontakt osoba *</Label>
          <Input
            id="kontakt_ime"
            value={formData.kontakt_ime}
            onChange={(e) => setFormData({ ...formData, kontakt_ime: e.target.value })}
            data-testid="zakupnik-kontakt-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="kontakt_email">Email *</Label>
          <Input
            id="kontakt_email"
            type="email"
            value={formData.kontakt_email}
            onChange={(e) => setFormData({ ...formData, kontakt_email: e.target.value })}
            data-testid="zakupnik-email-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="kontakt_telefon">Telefon *</Label>
          <Input
            id="kontakt_telefon"
            value={formData.kontakt_telefon}
            onChange={(e) => setFormData({ ...formData, kontakt_telefon: e.target.value })}
            data-testid="zakupnik-telefon-input"
            required
          />
        </div>
      </div>

      <div className="flex space-x-2">
        <Button type="submit" data-testid="potvrdi-zakupnik-form">
          Kreiraj zakupnika
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-zakupnik-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Ugovori Component
const Ugovori = () => {
  const [ugovori, setUgovori] = useState([]);
  const [nekretnine, setNekretnine] = useState([]);
  const [zakupnici, setZakupnici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('svi');
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [contractToCopy, setContractToCopy] = useState(null);
  const [renewalTemplate, setRenewalTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  useEffect(() => {
    fetchData();
    
    // Provjeri je li došao renewal request
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('action') === 'renew') {
      const template = sessionStorage.getItem('renewalTemplate');
      if (template) {
        setRenewalTemplate(JSON.parse(template));
        setShowCreateForm(true);
        sessionStorage.removeItem('renewalTemplate');
      }
    }
  }, [location]);

  const fetchData = async () => {
    try {
      const [ugovoriRes, nekretnineRes, zakupniciRes] = await Promise.all([
        api.getUgovori(),
        api.getNekretnine(),
        api.getZakupnici()
      ]);
      setUgovori(ugovoriRes.data);
      setNekretnine(nekretnineRes.data);
      setZakupnici(zakupniciRes.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju podataka:', error);
      toast.error('Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUgovor = async (formData) => {
    try {
      await api.createUgovor(formData);
      toast.success('Ugovor je uspješno kreiran');
      fetchData();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju ugovora:', error);
      toast.error('Greška pri kreiranju ugovora');
    }
  };

  const handleStatusChange = async (ugovorId, noviStatus) => {
    try {
      await api.updateStatusUgovora(ugovorId, noviStatus);
      toast.success('Status ugovora je ažuriran');
      fetchData();
    } catch (error) {
      console.error('Greška pri ažuriranju statusa:', error);
      toast.error('Greška pri ažuriranju statusa');
    }
  };

  const getNekretnina = (nekretnina_id) => {
    return nekretnine.find(n => n.id === nekretnina_id);
  };

  const getZakupnik = (zakupnik_id) => {
    return zakupnici.find(z => z.id === zakupnik_id);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'aktivno': { label: 'Aktivno', variant: 'default' },
      'na_isteku': { label: 'Na isteku', variant: 'secondary' },
      'raskinuto': { label: 'Raskinuto', variant: 'destructive' },
      'arhivirano': { label: 'Arhivirano', variant: 'outline' }
    };
    
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const isUgovorNaIsteku = (ugovor) => {
    const danas = new Date();
    const datumZavrsetka = new Date(ugovor.datum_zavrsetka);
    const daniDo = Math.ceil((datumZavrsetka - danas) / (1000 * 60 * 60 * 24));
    return daniDo <= 90 && daniDo > 0; // Ugovori koji ističu u sljedećih 90 dana
  };

  const handleCopyContract = (ugovor) => {
    setContractToCopy(ugovor);
    setShowCopyDialog(true);
  };

  const handleCreateCopiedContract = async (godina) => {
    try {
      if (!contractToCopy) return;
      
      const noviDatumPocetka = new Date();
      const noviDatumZavrsetka = new Date();
      noviDatumZavrsetka.setFullYear(noviDatumZavrsetka.getFullYear() + godina);
      
      const noviUgovor = {
        interna_oznaka: `${contractToCopy.interna_oznaka}-COPY-${godina}G-${Date.now()}`,
        nekretnina_id: contractToCopy.nekretnina_id,
        zakupnik_id: contractToCopy.zakupnik_id,
        datum_potpisivanja: new Date().toISOString().split('T')[0],
        datum_pocetka: noviDatumPocetka.toISOString().split('T')[0],
        datum_zavrsetka: noviDatumZavrsetka.toISOString().split('T')[0],
        trajanje_mjeseci: godina * 12,
        opcija_produljenja: contractToCopy.opcija_produljenja,
        uvjeti_produljenja: contractToCopy.uvjeti_produljenja,
        rok_otkaza_dani: contractToCopy.rok_otkaza_dani,
        osnovna_zakupnina: contractToCopy.osnovna_zakupnina,
        zakupnina_po_m2: contractToCopy.zakupnina_po_m2,
        cam_troskovi: contractToCopy.cam_troskovi,
        polog_depozit: contractToCopy.polog_depozit,
        garancija: contractToCopy.garancija,
        indeksacija: contractToCopy.indeksacija,
        indeks: contractToCopy.indeks,
        formula_indeksacije: contractToCopy.formula_indeksacije,
        obveze_odrzavanja: contractToCopy.obveze_odrzavanja,
        namjena_prostora: contractToCopy.namjena_prostora,
        rezije_brojila: contractToCopy.rezije_brojila
      };

      await api.createUgovor(noviUgovor);
      toast.success(`Novi ugovor na ${godina} ${godina === 1 ? 'godinu' : 'godina'} je uspješno kreiran na osnovu postojećeg!`);
      setShowCopyDialog(false);
      setContractToCopy(null);
      fetchData();
    } catch (error) {
      console.error('Greška pri kreiranju kopije ugovora:', error);
      toast.error('Greška pri kreiranju kopije ugovora');
    }
  };

  const generateContractPDF = async (ugovor) => {
    try {
      toast.info('Generiranje PDF ugovora...');
      
      const nekretnina = getNekretnina(ugovor.nekretnina_id);
      const zakupnik = getZakupnik(ugovor.zakupnik_id);
      
      // Kreiraj novi PDF dokument
      const doc = new jsPDF();
      
      // Zaglavlje
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('UGOVOR O ZAKUPU', 105, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Broj: ${ugovor.interna_oznaka}`, 105, 30, { align: 'center' });
      
      // Linija
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      let yPos = 50;
      
      // Ugovorne strane
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('UGOVORNE STRANE:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text('ZAKUPODAVAC:', 20, yPos);
      yPos += 6;
      doc.text(nekretnina?.vlasnik || 'Vlasnik nekretnine', 30, yPos);
      yPos += 10;
      
      doc.text('ZAKUPNIK:', 20, yPos);
      yPos += 6;
      doc.text(zakupnik?.naziv_firme || zakupnik?.ime_prezime || 'Zakupnik', 30, yPos);
      yPos += 6;
      doc.text(`OIB: ${zakupnik?.oib}`, 30, yPos);
      yPos += 6;
      doc.text(`Adresa: ${zakupnik?.sjediste}`, 30, yPos);
      yPos += 15;
      
      // Predmet ugovora
      doc.setFont('helvetica', 'bold');
      doc.text('PREDMET UGOVORA:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Nekretnina: ${nekretnina?.naziv}`, 20, yPos);
      yPos += 6;
      doc.text(`Adresa: ${nekretnina?.adresa}`, 20, yPos);
      yPos += 6;
      doc.text(`Katastarska općina: ${nekretnina?.katastarska_opcina}`, 20, yPos);
      yPos += 6;
      doc.text(`Broj kat. čestice: ${nekretnina?.broj_kat_cestice}`, 20, yPos);
      yPos += 6;
      doc.text(`Površina: ${nekretnina?.povrsina} m²`, 20, yPos);
      yPos += 6;
      doc.text(`Namjena: ${ugovor.namjena_prostora || 'Nisu specificirane'}`, 20, yPos);
      yPos += 15;
      
      // Vrijeme trajanja
      doc.setFont('helvetica', 'bold');
      doc.text('VRIJEME TRAJANJA:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Početak zakupa: ${new Date(ugovor.datum_pocetka).toLocaleDateString()}`, 20, yPos);
      yPos += 6;
      doc.text(`Završetak zakupa: ${new Date(ugovor.datum_zavrsetka).toLocaleDateString()}`, 20, yPos);
      yPos += 6;
      doc.text(`Trajanje: ${ugovor.trajanje_mjeseci} mjeseci`, 20, yPos);
      yPos += 6;
      doc.text(`Rok otkaza: ${ugovor.rok_otkaza_dani} dana`, 20, yPos);
      yPos += 15;
      
      // Financijske odredbe
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIJSKE ODREDBE:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Mjesečna zakupnina: ${ugovor.osnovna_zakupnina.toLocaleString()} EUR`, 20, yPos);
      yPos += 6;
      
      if (ugovor.zakupnina_po_m2) {
        doc.text(`Zakupnina po m²: ${ugovor.zakupnina_po_m2.toLocaleString()} EUR/m²`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.cam_troskovi) {
        doc.text(`CAM troškovi: ${ugovor.cam_troskovi.toLocaleString()} EUR`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.polog_depozit) {
        doc.text(`Polog/depozit: ${ugovor.polog_depozit.toLocaleString()} EUR`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.garancija) {
        doc.text(`Garancija: ${ugovor.garancija.toLocaleString()} EUR`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.indeksacija) {
        doc.text(`Indeksacija: DA (${ugovor.indeks}, ${ugovor.formula_indeksacije})`, 20, yPos);
        yPos += 6;
      }
      
      yPos += 10;
      
      // Obveze održavanja
      if (ugovor.obveze_odrzavanja) {
        doc.setFont('helvetica', 'bold');
        doc.text('OBVEZE ODRŽAVANJA:', 20, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Odgovorno: ${ugovor.obveze_odrzavanja}`, 20, yPos);
        yPos += 15;
      }
      
      // Režije
      if (ugovor.rezije_brojila) {
        doc.setFont('helvetica', 'bold');
        doc.text('REŽIJE I BROJILA:', 20, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        const rezije = doc.splitTextToSize(ugovor.rezije_brojila, 170);
        doc.text(rezije, 20, yPos);
        yPos += rezije.length * 6 + 10;
      }
      
      // Opcija produljenja
      if (ugovor.opcija_produljenja) {
        doc.setFont('helvetica', 'bold');
        doc.text('OPCIJA PRODULJENJA:', 20, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.text('DA', 20, yPos);
        if (ugovor.uvjeti_produljenja) {
          yPos += 6;
          const uvjeti = doc.splitTextToSize(`Uvjeti: ${ugovor.uvjeti_produljenja}`, 170);
          doc.text(uvjeti, 20, yPos);
          yPos += uvjeti.length * 6;
        }
        yPos += 10;
      }
      
      // Potpisi
      yPos = Math.max(yPos, 240);
      doc.setFont('helvetica', 'bold');
      doc.text('POTPISI:', 20, yPos);
      yPos += 15;
      
      doc.setFont('helvetica', 'normal');
      doc.text('Zakupodavac:', 20, yPos);
      doc.text('Zakupnik:', 120, yPos);
      yPos += 20;
      
      doc.text('_____________________', 20, yPos);
      doc.text('_____________________', 120, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.text(`Zagreb, ${new Date(ugovor.datum_potpisivanja).toLocaleDateString()}`, 20, yPos);
      
      // Datum generiranja
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Ugovor generiran: ${new Date().toLocaleString()}`, 20, 285);
      
      // Spremi PDF
      const fileName = `Ugovor_${ugovor.interna_oznaka.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success(`PDF ugovor ${ugovor.interna_oznaka} je uspješno generiran za potpis!`);
    } catch (error) {
      console.error('Greška pri generiranju PDF ugovora:', error);
      toast.error('Greška pri generiranju PDF ugovora');
    }
  };

  const filteredUgovori = ugovori.filter(ugovor => {
    // Prvo filtriraj po statusu
    let matches = true;
    if (filterStatus !== 'svi') {
      if (filterStatus === 'na_isteku') {
        matches = isUgovorNaIsteku(ugovor);
      } else {
        matches = ugovor.status === filterStatus;
      }
    }
    
    // Zatim filtriraj po pretraživanju
    if (matches && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nekretnina = getNekretnina(ugovor.nekretnina_id);
      const zakupnik = getZakupnik(ugovor.zakupnik_id);
      
      matches = ugovor.interna_oznaka.toLowerCase().includes(query) ||
               nekretnina?.naziv.toLowerCase().includes(query) ||
               nekretnina?.adresa.toLowerCase().includes(query) ||
               zakupnik?.naziv_firme?.toLowerCase().includes(query) ||
               zakupnik?.ime_prezime?.toLowerCase().includes(query) ||
               zakupnik?.oib.includes(query);
    }
    
    return matches;
  });

  if (loading) {
    return <div className="p-8">Učitava ugovore...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Ugovori o zakupu</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Pretraži ugovore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
              data-testid="search-contracts-input"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            data-testid="dodaj-ugovor-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj ugovor
          </Button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex space-x-2">
        <Button 
          variant={filterStatus === 'svi' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('svi')}
          size="sm"
        >
          Svi ({ugovori.length})
        </Button>
        <Button 
          variant={filterStatus === 'aktivno' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('aktivno')}
          size="sm"
        >
          Aktivni ({ugovori.filter(u => u.status === 'aktivno').length})
        </Button>
        <Button 
          variant={filterStatus === 'na_isteku' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('na_isteku')}
          size="sm"
          className="bg-orange-100 text-orange-700 hover:bg-orange-200"
        >
          <Bell className="w-4 h-4 mr-1" />
          Na isteku ({ugovori.filter(u => isUgovorNaIsteku(u)).length})
        </Button>
        <Button 
          variant={filterStatus === 'raskinuto' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('raskinuto')}
          size="sm"
        >
          Raskinuti ({ugovori.filter(u => u.status === 'raskinuto').length})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredUgovori.map((ugovor) => {
          const nekretnina = getNekretnina(ugovor.nekretnina_id);
          const zakupnik = getZakupnik(ugovor.zakupnik_id);
          const naIsteku = isUgovorNaIsteku(ugovor);
          
          return (
            <Card key={ugovor.id} className={naIsteku ? 'border-orange-200 bg-orange-50' : ''} data-testid={`ugovor-card-${ugovor.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {ugovor.interna_oznaka}
                  <div className="flex space-x-2">
                    {naIsteku && <Badge variant="secondary" className="bg-orange-200 text-orange-800">⚠️ Ističe uskoro</Badge>}
                    {getStatusBadge(ugovor.status)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-blue-600">{nekretnina?.naziv}</p>
                  <p className="text-sm text-gray-600">{nekretnina?.adresa}</p>
                </div>
                <div>
                  <p className="font-medium">{zakupnik?.naziv_firme || zakupnik?.ime_prezime}</p>
                  <p className="text-sm text-gray-600">OIB: {zakupnik?.oib}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Početak:</span> {new Date(ugovor.datum_pocetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Završetak:</span> {new Date(ugovor.datum_zavrsetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Trajanje:</span> {ugovor.trajanje_mjeseci} mj.
                  </div>
                  <div>
                    <span className="font-medium">Otkaz:</span> {ugovor.rok_otkaza_dani} dana
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-lg font-bold text-green-600">
                    {ugovor.osnovna_zakupnina.toLocaleString()} €/mjesec
                  </p>
                  {ugovor.zakupnina_po_m2 && (
                    <p className="text-sm text-gray-600">
                      {ugovor.zakupnina_po_m2.toLocaleString()} €/m²
                    </p>
                  )}
                  {ugovor.polog_depozit && (
                    <p className="text-sm text-gray-600">
                      Polog: {ugovor.polog_depozit.toLocaleString()} €
                    </p>
                  )}
                </div>
                
                {/* Status change dropdown */}
                <div className="flex items-center space-x-2 pt-2">
                  <Select 
                    value={ugovor.status} 
                    onValueChange={(value) => handleStatusChange(ugovor.id, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktivno">Aktivno</SelectItem>
                      <SelectItem value="na_isteku">Na isteku</SelectItem>
                      <SelectItem value="raskinuto">Raskinuto</SelectItem>
                      <SelectItem value="arhivirano">Arhivirano</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {ugovor.opcija_produljenja && (
                    <Badge variant="outline" className="text-xs">
                      Opcija produljenja
                    </Badge>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyContract(ugovor)}
                    data-testid={`copy-contract-${ugovor.id}`}
                    className="ml-2"
                  >
                    📋 Kopiraj
                  </Button>
                  
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => generateContractPDF(ugovor)}
                    data-testid={`generate-pdf-${ugovor.id}`}
                    className="ml-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    📄 PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Contract Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="ugovor-form-description">
          <DialogHeader>
            <DialogTitle>
              {renewalTemplate ? 'Produžetak ugovora - Nova interna oznaka' : 'Dodaj novi ugovor'}
            </DialogTitle>
          </DialogHeader>
          <div id="ugovor-form-description" className="sr-only">
            Forma za kreiranje novog ugovora o zakupu
          </div>
          <UgovorForm 
            nekretnine={nekretnine}
            zakupnici={zakupnici}
            onSubmit={handleCreateUgovor}
            onCancel={() => {
              setShowCreateForm(false);
              setRenewalTemplate(null);
            }}
            renewalTemplate={renewalTemplate}
          />
        </DialogContent>
      </Dialog>

      {/* Copy Contract Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="copy-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Kreiraj novi ugovor na osnovu postojećeg
            </DialogTitle>
          </DialogHeader>
          <div id="copy-dialog-description" className="sr-only">
            Dialog za kreiranje novog ugovora na osnovu postojećeg s opcijama 1, 2 ili 5 godina
          </div>

          {contractToCopy && (
            <div className="space-y-6">
              {/* Original contract details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Kopira se ugovor:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Oznaka:</span> {contractToCopy.interna_oznaka}
                  </div>
                  <div>
                    <span className="font-medium">Kirija:</span> {contractToCopy.osnovna_zakupnina?.toLocaleString()} €
                  </div>
                  <div>
                    <span className="font-medium">Početak:</span> {new Date(contractToCopy.datum_pocetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Završetak:</span> {new Date(contractToCopy.datum_zavrsetka).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Copy options */}
              <div>
                <h3 className="font-medium mb-4">Odaberite trajanje novog ugovora:</h3>
                <div className="grid grid-cols-1 gap-3">
                  
                  <Card 
                    className="cursor-pointer hover:bg-blue-50 border-2 hover:border-blue-300 transition-all"
                    onClick={() => handleCreateCopiedContract(1)}
                    data-testid="copy-option-1-year"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-lg">1 Godina</h4>
                          <p className="text-sm text-gray-600">
                            Ista kirija: {contractToCopy.osnovna_zakupnina?.toLocaleString()} €/mjesec
                          </p>
                          <p className="text-xs text-gray-500">Početak: danas, završetak: za godinu dana</p>
                        </div>
                        <Badge variant="default">Kratko</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:bg-green-50 border-2 hover:border-green-300 transition-all"
                    onClick={() => handleCreateCopiedContract(2)}
                    data-testid="copy-option-2-years"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-lg">2 Godine</h4>
                          <p className="text-sm text-gray-600">
                            Ista kirija: {contractToCopy.osnovna_zakupnina?.toLocaleString()} €/mjesec
                          </p>
                          <p className="text-xs text-gray-500">Početak: danas, završetak: za 2 godine</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-200 text-green-800">Preporučeno</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:bg-purple-50 border-2 hover:border-purple-300 transition-all"
                    onClick={() => handleCreateCopiedContract(5)}
                    data-testid="copy-option-5-years"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-lg">5 Godina</h4>
                          <p className="text-sm text-gray-600">
                            Ista kirija: {contractToCopy.osnovna_zakupnina?.toLocaleString()} €/mjesec
                          </p>
                          <p className="text-xs text-gray-500">Početak: danas, završetak: za 5 godina</p>
                        </div>
                        <Badge variant="outline" className="border-purple-300 text-purple-700">Dugoročno</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCopyDialog(false)}
                  className="flex-1"
                  data-testid="cancel-copy"
                >
                  Otkaži
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Ugovor Form Component
const UgovorForm = ({ nekretnine, zakupnici, onSubmit, onCancel, renewalTemplate }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [formData, setFormData] = useState({
    interna_oznaka: '',
    nekretnina_id: '',
    zakupnik_id: '',
    datum_potpisivanja: '',
    datum_pocetka: '',
    datum_zavrsetka: '',
    trajanje_mjeseci: '',
    opcija_produljenja: false,
    uvjeti_produljenja: '',
    rok_otkaza_dani: 30,
    osnovna_zakupnina: '',
    zakupnina_po_m2: '',
    cam_troskovi: '',
    polog_depozit: '',
    garancija: '',
    indeksacija: false,
    indeks: '',
    formula_indeksacije: '',
    obveze_odrzavanja: '',
    namjena_prostora: '',
    rezije_brojila: ''
  });

  useEffect(() => {
    if (renewalTemplate) {
      setFormData({
        interna_oznaka: renewalTemplate.interna_oznaka,
        nekretnina_id: renewalTemplate.nekretnina_id,
        zakupnik_id: renewalTemplate.zakupnik_id,
        datum_potpisivanja: renewalTemplate.datum_potpisivanja,
        datum_pocetka: renewalTemplate.datum_pocetka,
        datum_zavrsetka: renewalTemplate.datum_zavrsetka,
        trajanje_mjeseci: renewalTemplate.trajanje_mjeseci.toString(),
        opcija_produljenja: renewalTemplate.opcija_produljenja,
        uvjeti_produljenja: renewalTemplate.uvjeti_produljenja || '',
        rok_otkaza_dani: renewalTemplate.rok_otkaza_dani,
        osnovna_zakupnina: renewalTemplate.osnovna_zakupnina.toString(),
        zakupnina_po_m2: renewalTemplate.zakupnina_po_m2?.toString() || '',
        cam_troskovi: renewalTemplate.cam_troskovi?.toString() || '',
        polog_depozit: renewalTemplate.polog_depozit?.toString() || '',
        garancija: renewalTemplate.garancija?.toString() || '',
        indeksacija: renewalTemplate.indeksacija,
        indeks: renewalTemplate.indeks || '',
        formula_indeksacije: renewalTemplate.formula_indeksacije || '',
        obveze_odrzavanja: renewalTemplate.obveze_odrzavanja || '',
        namjena_prostora: renewalTemplate.namjena_prostora || '',
        rezije_brojila: renewalTemplate.rezije_brojila || ''
      });
    }
  }, [renewalTemplate]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Molimo odaberite PDF datoteku');
      return;
    }

    setUploadedFile(file);
    setIsParsing(true);

    try {
      toast.info('Analiziram PDF ugovor...');
      const response = await api.parsePdfContract(file);
      const parsedData = response.data;

      // Popuni formu s podacima iz PDF-a
      setFormData(prevData => ({
        ...prevData,
        interna_oznaka: parsedData.interna_oznaka || prevData.interna_oznaka,
        datum_potpisivanja: parsedData.datum_potpisivanja || prevData.datum_potpisivanja,
        datum_pocetka: parsedData.datum_pocetka || prevData.datum_pocetka,
        datum_zavrsetka: parsedData.datum_zavrsetka || prevData.datum_zavrsetka,
        trajanje_mjeseci: parsedData.trajanje_mjeseci?.toString() || prevData.trajanje_mjeseci,
        osnovna_zakupnina: parsedData.osnovna_zakupnina?.toString() || prevData.osnovna_zakupnina,
        zakupnina_po_m2: parsedData.zakupnina_po_m2?.toString() || prevData.zakupnina_po_m2,
        cam_troskovi: parsedData.cam_troskovi?.toString() || prevData.cam_troskovi,
        polog_depozit: parsedData.polog_depozit?.toString() || prevData.polog_depozit,
        garancija: parsedData.garancija?.toString() || prevData.garancija,
        rok_otkaza_dani: parsedData.rok_otkaza_dani || prevData.rok_otkaza_dani,
        opcija_produljenja: parsedData.opcija_produljenja || prevData.opcija_produljenja,
        uvjeti_produljenja: parsedData.uvjeti_produljenja || prevData.uvjeti_produljenja,
        indeksacija: parsedData.indeksacija || prevData.indeksacija,
        indeks: parsedData.indeks || prevData.indeks,
        formula_indeksacije: parsedData.formula_indeksacije || prevData.formula_indeksacije,
        obveze_odrzavanja: parsedData.obveze_odrzavanja || prevData.obveze_odrzavanja,
        namjena_prostora: parsedData.namjena_prostora || prevData.namjena_prostora,
        rezije_brojila: parsedData.rezije_brojila || prevData.rezije_brojila
      }));

      toast.success('PDF ugovor je uspješno analiziran i podaci su uneseni u formu!');
    } catch (error) {
      console.error('Greška pri analizi PDF-a:', error);
      toast.error('Greška pri analizi PDF ugovora. Molimo unesite podatke ručno.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    document.getElementById('pdf-upload').value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      trajanje_mjeseci: parseInt(formData.trajanje_mjeseci),
      rok_otkaza_dani: parseInt(formData.rok_otkaza_dani),
      osnovna_zakupnina: parseFloat(formData.osnovna_zakupnina),
      zakupnina_po_m2: formData.zakupnina_po_m2 ? parseFloat(formData.zakupnina_po_m2) : null,
      cam_troskovi: formData.cam_troskovi ? parseFloat(formData.cam_troskovi) : null,
      polog_depozit: formData.polog_depozit ? parseFloat(formData.polog_depozit) : null,
      garancija: formData.garancija ? parseFloat(formData.garancija) : null
    };
    
    // Ako je renewal, arhiviraj stari ugovor
    if (renewalTemplate?._isRenewal && renewalTemplate._oldContractId) {
      try {
        await api.updateStatusUgovora(renewalTemplate._oldContractId, 'arhivirano');
        toast.info('Stari ugovor je uspješno arhiviran');
      } catch (error) {
        console.error('Greška pri arhiviranju starog ugovora:', error);
        toast.warning('Novi ugovor je kreiran, ali stari nije arhiviran automatski');
      }
    }
    
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="ugovor-form">
      {/* PDF Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            📄 AI Analiza PDF Ugovora
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Učitajte postojeći PDF ugovor za automatsko popunjavanje forme
          </p>
          
          {!uploadedFile ? (
            <div>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isParsing}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('pdf-upload').click()}
                disabled={isParsing}
                className="mb-2"
              >
                {isParsing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Analiziram PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Odaberite PDF ugovor
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {uploadedFile.name}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveFile}
                disabled={isParsing}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-2">
            Podržani format: PDF • AI će pokušati izvući podatke iz ugovora
          </p>
        </div>
      </div>

      <Tabs defaultValue="osnovni" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="osnovni">Osnovni podaci</TabsTrigger>
          <TabsTrigger value="financije">Financije</TabsTrigger>
          <TabsTrigger value="uvjeti">Uvjeti</TabsTrigger>
        </TabsList>
        
        <TabsContent value="osnovni" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="interna_oznaka">Interna oznaka ugovora *</Label>
              <Input
                id="interna_oznaka"
                value={formData.interna_oznaka}
                onChange={(e) => setFormData({ ...formData, interna_oznaka: e.target.value })}
                data-testid="ugovor-oznaka-input"
                placeholder="npr. UG-2025-001"
                required
              />
            </div>
            <div>
              <Label htmlFor="datum_potpisivanja">Datum potpisivanja *</Label>
              <Input
                id="datum_potpisivanja"
                type="date"
                value={formData.datum_potpisivanja}
                onChange={(e) => setFormData({ ...formData, datum_potpisivanja: e.target.value })}
                data-testid="ugovor-potpis-input"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="nekretnina_id">Nekretnina *</Label>
            <Select value={formData.nekretnina_id} onValueChange={(value) => setFormData({ ...formData, nekretnina_id: value })}>
              <SelectTrigger data-testid="ugovor-nekretnina-select">
                <SelectValue placeholder="Izaberite nekretninu" />
              </SelectTrigger>
              <SelectContent>
                {nekretnine.map((nekretnina) => (
                  <SelectItem key={nekretnina.id} value={nekretnina.id}>
                    {nekretnina.naziv} - {nekretnina.adresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="zakupnik_id">Zakupnik *</Label>
            <Select value={formData.zakupnik_id} onValueChange={(value) => setFormData({ ...formData, zakupnik_id: value })}>
              <SelectTrigger data-testid="ugovor-zakupnik-select">
                <SelectValue placeholder="Izaberite zakupnika" />
              </SelectTrigger>
              <SelectContent>
                {zakupnici.map((zakupnik) => (
                  <SelectItem key={zakupnik.id} value={zakupnik.id}>
                    {zakupnik.naziv_firme || zakupnik.ime_prezime} - {zakupnik.oib}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="datum_pocetka">Početak zakupa *</Label>
              <Input
                id="datum_pocetka"
                type="date"
                value={formData.datum_pocetka}
                onChange={(e) => setFormData({ ...formData, datum_pocetka: e.target.value })}
                data-testid="ugovor-pocetak-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="datum_zavrsetka">Završetak zakupa *</Label>
              <Input
                id="datum_zavrsetka"
                type="date"
                value={formData.datum_zavrsetka}
                onChange={(e) => setFormData({ ...formData, datum_zavrsetka: e.target.value })}
                data-testid="ugovor-zavrsetak-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="trajanje_mjeseci">Trajanje (mjeseci) *</Label>
              <Input
                id="trajanje_mjeseci"
                type="number"
                value={formData.trajanje_mjeseci}
                onChange={(e) => setFormData({ ...formData, trajanje_mjeseci: e.target.value })}
                data-testid="ugovor-trajanje-input"
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financije" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="osnovna_zakupnina">Osnovna zakupnina (€/mjesec) *</Label>
              <Input
                id="osnovna_zakupnina"
                type="number"
                step="0.01"
                value={formData.osnovna_zakupnina}
                onChange={(e) => setFormData({ ...formData, osnovna_zakupnina: e.target.value })}
                data-testid="ugovor-zakupnina-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="zakupnina_po_m2">Zakupnina po m² (€/m²)</Label>
              <Input
                id="zakupnina_po_m2"
                type="number"
                step="0.01"
                value={formData.zakupnina_po_m2}
                onChange={(e) => setFormData({ ...formData, zakupnina_po_m2: e.target.value })}
                data-testid="ugovor-m2-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cam_troskovi">CAM troškovi (€)</Label>
              <Input
                id="cam_troskovi"
                type="number"
                step="0.01"
                value={formData.cam_troskovi}
                onChange={(e) => setFormData({ ...formData, cam_troskovi: e.target.value })}
                data-testid="ugovor-cam-input"
              />
            </div>
            <div>
              <Label htmlFor="polog_depozit">Polog/Depozit (€)</Label>
              <Input
                id="polog_depozit"
                type="number"
                step="0.01"
                value={formData.polog_depozit}
                onChange={(e) => setFormData({ ...formData, polog_depozit: e.target.value })}
                data-testid="ugovor-polog-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="garancija">Garancija (€)</Label>
            <Input
              id="garancija"
              type="number"
              step="0.01"
              value={formData.garancija}
              onChange={(e) => setFormData({ ...formData, garancija: e.target.value })}
              data-testid="ugovor-garancija-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="indeksacija"
                checked={formData.indeksacija}
                onChange={(e) => setFormData({ ...formData, indeksacija: e.target.checked })}
                data-testid="ugovor-indeksacija-checkbox"
              />
              <Label htmlFor="indeksacija">Indeksacija</Label>
            </div>
            {formData.indeksacija && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <Label htmlFor="indeks">Indeks</Label>
                  <Input
                    id="indeks"
                    value={formData.indeks}
                    onChange={(e) => setFormData({ ...formData, indeks: e.target.value })}
                    data-testid="ugovor-indeks-input"
                    placeholder="npr. potrošačke cijene"
                  />
                </div>
                <div>
                  <Label htmlFor="formula_indeksacije">Formula</Label>
                  <Input
                    id="formula_indeksacije"
                    value={formData.formula_indeksacije}
                    onChange={(e) => setFormData({ ...formData, formula_indeksacije: e.target.value })}
                    data-testid="ugovor-formula-input"
                    placeholder="npr. godišnje +3%"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="uvjeti" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rok_otkaza_dani">Rok otkaza (dani)</Label>
              <Input
                id="rok_otkaza_dani"
                type="number"
                value={formData.rok_otkaza_dani}
                onChange={(e) => setFormData({ ...formData, rok_otkaza_dani: e.target.value })}
                data-testid="ugovor-otkaz-input"
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="opcija_produljenja"
                checked={formData.opcija_produljenja}
                onChange={(e) => setFormData({ ...formData, opcija_produljenja: e.target.checked })}
                data-testid="ugovor-produljenje-checkbox"
              />
              <Label htmlFor="opcija_produljenja">Opcija produljenja</Label>
            </div>
          </div>

          {formData.opcija_produljenja && (
            <div>
              <Label htmlFor="uvjeti_produljenja">Uvjeti produljenja</Label>
              <Textarea
                id="uvjeti_produljenja"
                value={formData.uvjeti_produljenja}
                onChange={(e) => setFormData({ ...formData, uvjeti_produljenja: e.target.value })}
                data-testid="ugovor-uvjeti-input"
              />
            </div>
          )}

          <div>
            <Label htmlFor="obveze_odrzavanja">Obveze održavanja</Label>
            <Select value={formData.obveze_odrzavanja} onValueChange={(value) => setFormData({ ...formData, obveze_odrzavanja: value })}>
              <SelectTrigger data-testid="ugovor-odrzavanje-select">
                <SelectValue placeholder="Izaberite odgovorno lice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zakupodavac">Zakupodavac</SelectItem>
                <SelectItem value="zakupnik">Zakupnik</SelectItem>
                <SelectItem value="podijeljeno">Podijeljeno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="namjena_prostora">Namjena prostora</Label>
            <Input
              id="namjena_prostora"
              value={formData.namjena_prostora}
              onChange={(e) => setFormData({ ...formData, namjena_prostora: e.target.value })}
              data-testid="ugovor-namjena-input"
              placeholder="npr. uredski prostor, trgovina"
            />
          </div>

          <div>
            <Label htmlFor="rezije_brojila">Režije i brojila</Label>
            <Textarea
              id="rezije_brojila"
              value={formData.rezije_brojila}
              onChange={(e) => setFormData({ ...formData, rezije_brojila: e.target.value })}
              data-testid="ugovor-rezije-input"
              placeholder="Opišite režijske troškove i brojila"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex space-x-2 pt-4">
        <Button type="submit" data-testid="potvrdi-ugovor-form">
          {renewalTemplate ? 'Kreiraj produžetak' : 'Kreiraj ugovor'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-ugovor-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Dokumenti Component
const Dokumenti = () => {
  const [dokumenti, setDokumenti] = useState([]);
  const [nekretnine, setNekretnine] = useState([]);
  const [zakupnici, setZakupnici] = useState([]);
  const [ugovori, setUgovori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('svi');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dokumentiRes, nekretnineRes, zakupniciRes, ugovoriRes] = await Promise.all([
        api.getDokumenti(),
        api.getNekretnine(),
        api.getZakupnici(),
        api.getUgovori()
      ]);
      setDokumenti(dokumentiRes.data);
      setNekretnine(nekretnineRes.data);
      setZakupnici(zakupniciRes.data);
      setUgovori(ugovoriRes.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju dokumenata:', error);
      toast.error('Greška pri učitavanju dokumenata');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDokument = async (formData) => {
    try {
      await api.createDokument(formData);
      toast.success('Dokument je uspješno dodan');
      fetchData();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri dodavanju dokumenta:', error);
      toast.error('Greška pri dodavanju dokumenta');
    }
  };

  const getLinkedEntity = (dokument) => {
    if (dokument.nekretnina_id) {
      const nekretnina = nekretnine.find(n => n.id === dokument.nekretnina_id);
      return { tip: 'Nekretnina', naziv: nekretnina?.naziv };
    } else if (dokument.zakupnik_id) {
      const zakupnik = zakupnici.find(z => z.id === dokument.zakupnik_id);
      return { tip: 'Zakupnik', naziv: zakupnik?.naziv_firme || zakupnik?.ime_prezime };
    } else if (dokument.ugovor_id) {
      const ugovor = ugovori.find(u => u.id === dokument.ugovor_id);
      return { tip: 'Ugovor', naziv: ugovor?.interna_oznaka };
    }
    return { tip: 'Općenito', naziv: 'Nema povezanost' };
  };

  const getTipLabel = (tip) => {
    const tipMap = {
      'ugovor': 'Ugovor',
      'aneks': 'Aneks',
      'certifikat': 'Certifikat',
      'osiguranje': 'Osiguranje',
      'zemljisnoknjizni_izvadak': 'Zemljišnoknjižni izvadak',
      'uporabna_dozvola': 'Uporabna dozvola',
      'gradevinska_dozvola': 'Građevinska dozvola',
      'energetski_certifikat': 'Energetski certifikat',
      'izvadak_iz_registra': 'Izvadak iz registra',
      'bon_2': 'BON-2',
      'ostalo': 'Ostalo'
    };
    return tipMap[tip] || tip;
  };

  const filteredDokumenti = dokumenti.filter(dokument => {
    // Prvo filtriraj po kategoriji
    let matches = true;
    if (filterCategory !== 'svi') {
      matches = dokument.tip === filterCategory;
    }
    
    // Zatim filtriraj po pretraživanju
    if (matches && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const linkedEntity = getLinkedEntity(dokument);
      
      matches = dokument.naziv.toLowerCase().includes(query) ||
               dokument.opis?.toLowerCase().includes(query) ||
               dokument.uploadao.toLowerCase().includes(query) ||
               getTipLabel(dokument.tip).toLowerCase().includes(query) ||
               linkedEntity.naziv?.toLowerCase().includes(query);
    }
    
    return matches;
  });

  if (loading) {
    return <div className="p-8">Učitava dokumente...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dokumenti</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Pretraži dokumente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
              data-testid="search-documents-input"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            data-testid="dodaj-dokument-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj dokument
          </Button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex space-x-2 flex-wrap">
        <Button 
          variant={filterCategory === 'svi' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('svi')}
          size="sm"
        >
          Svi ({dokumenti.length})
        </Button>
        <Button 
          variant={filterCategory === 'ugovor' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('ugovor')}
          size="sm"
        >
          Ugovori
        </Button>
        <Button 
          variant={filterCategory === 'zemljisnoknjizni_izvadak' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('zemljisnoknjizni_izvadak')}
          size="sm"
        >
          Z.K. izvadci
        </Button>
        <Button 
          variant={filterCategory === 'osiguranje' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('osiguranje')}
          size="sm"
        >
          Osiguranja
        </Button>
        <Button 
          variant={filterCategory === 'certifikat' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('certifikat')}
          size="sm"
        >
          Certifikati
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDokumenti.map((dokument) => {
          const linkedEntity = getLinkedEntity(dokument);
          
          return (
            <Card key={dokument.id} data-testid={`dokument-card-${dokument.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{dokument.naziv}</span>
                  <Badge variant="outline">
                    {getTipLabel(dokument.tip)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Vezano za:</span> {linkedEntity.tip}
                </p>
                <p className="text-sm text-blue-600">{linkedEntity.naziv}</p>
                <p className="text-sm">
                  <span className="font-medium">Verzija:</span> {dokument.verzija}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Uploadao:</span> {dokument.uploadao}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Datum:</span> {new Date(dokument.kreiran).toLocaleDateString()}
                </p>
                {dokument.opis && (
                  <p className="text-sm text-gray-600">{dokument.opis}</p>
                )}
                <div className="pt-2">
                  <div className="flex space-x-1">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="w-4 h-4 mr-1" />
                      Pregled
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Document Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl" aria-describedby="dokument-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj novi dokument</DialogTitle>
          </DialogHeader>
          <div id="dokument-form-description" className="sr-only">
            Forma za dodavanje novog dokumenta s kategorizacijom
          </div>
          <DokumentForm 
            nekretnine={nekretnine}
            zakupnici={zakupnici}
            ugovori={ugovori}
            onSubmit={handleCreateDokument}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Dokument Form Component
const DokumentForm = ({ nekretnine, zakupnici, ugovori, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    naziv: '',
    tip: 'ugovor',
    opis: '',
    verzija: '1.0',
    nekretnina_id: '',
    zakupnik_id: '',
    ugovor_id: '',
    uploadao: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      nekretnina_id: formData.nekretnina_id || null,
      zakupnik_id: formData.zakupnik_id || null,
      ugovor_id: formData.ugovor_id || null
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="dokument-form">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="naziv">Naziv dokumenta *</Label>
          <Input
            id="naziv"
            value={formData.naziv}
            onChange={(e) => setFormData({ ...formData, naziv: e.target.value })}
            data-testid="dokument-naziv-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="tip">Tip dokumenta *</Label>
          <Select value={formData.tip} onValueChange={(value) => setFormData({ ...formData, tip: value })}>
            <SelectTrigger data-testid="dokument-tip-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ugovor">Ugovor</SelectItem>
              <SelectItem value="aneks">Aneks</SelectItem>
              <SelectItem value="zemljisnoknjizni_izvadak">Zemljišnoknjižni izvadak</SelectItem>
              <SelectItem value="uporabna_dozvola">Uporabna dozvola</SelectItem>
              <SelectItem value="gradevinska_dozvola">Građevinska dozvola</SelectItem>
              <SelectItem value="energetski_certifikat">Energetski certifikat</SelectItem>
              <SelectItem value="osiguranje">Osiguranje</SelectItem>
              <SelectItem value="izvadak_iz_registra">Izvadak iz registra</SelectItem>
              <SelectItem value="bon_2">BON-2</SelectItem>
              <SelectItem value="certifikat">Certifikat</SelectItem>
              <SelectItem value="ostalo">Ostalo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="opis">Opis dokumenta</Label>
        <Textarea
          id="opis"
          value={formData.opis}
          onChange={(e) => setFormData({ ...formData, opis: e.target.value })}
          data-testid="dokument-opis-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="verzija">Verzija</Label>
          <Input
            id="verzija"
            value={formData.verzija}
            onChange={(e) => setFormData({ ...formData, verzija: e.target.value })}
            data-testid="dokument-verzija-input"
          />
        </div>
        <div>
          <Label htmlFor="uploadao">Uploadao *</Label>
          <Input
            id="uploadao"
            value={formData.uploadao}
            onChange={(e) => setFormData({ ...formData, uploadao: e.target.value })}
            data-testid="dokument-uploadao-input"
            required
          />
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium">Poveži s entitetom (opcionalno)</h4>
        
        <div>
          <Label htmlFor="nekretnina_id">Nekretnina</Label>
          <Select value={formData.nekretnina_id} onValueChange={(value) => setFormData({ ...formData, nekretnina_id: value, zakupnik_id: '', ugovor_id: '' })}>
            <SelectTrigger data-testid="dokument-nekretnina-select">
              <SelectValue placeholder="Izaberite nekretninu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nema veze s nekretninom</SelectItem>
              {nekretnine.map((nekretnina) => (
                <SelectItem key={nekretnina.id} value={nekretnina.id}>
                  {nekretnina.naziv} - {nekretnina.adresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="zakupnik_id">Zakupnik</Label>
          <Select value={formData.zakupnik_id} onValueChange={(value) => setFormData({ ...formData, zakupnik_id: value, nekretnina_id: '', ugovor_id: '' })}>
            <SelectTrigger data-testid="dokument-zakupnik-select">
              <SelectValue placeholder="Izaberite zakupnika" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nema veze sa zakupnikom</SelectItem>
              {zakupnici.map((zakupnik) => (
                <SelectItem key={zakupnik.id} value={zakupnik.id}>
                  {zakupnik.naziv_firme || zakupnik.ime_prezime} - {zakupnik.oib}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="ugovor_id">Ugovor</Label>
          <Select value={formData.ugovor_id} onValueChange={(value) => setFormData({ ...formData, ugovor_id: value, nekretnina_id: '', zakupnik_id: '' })}>
            <SelectTrigger data-testid="dokument-ugovor-select">
              <SelectValue placeholder="Izaberite ugovor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nema veze s ugovorom</SelectItem>
              {ugovori.map((ugovor) => (
                <SelectItem key={ugovor.id} value={ugovor.id}>
                  {ugovor.interna_oznaka}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex space-x-2 pt-4">
        <Button type="submit" data-testid="potvrdi-dokument-form">
          Dodaj dokument
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-dokument-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Podsjećanja Component
const Podsjetnici = () => {
  const [podsjetnici, setPodsjetnici] = useState([]);
  const [ugovori, setUgovori] = useState([]);
  const [nekretnine, setNekretnine] = useState([]);
  const [zakupnici, setZakupnici] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [podsjedniciRes, ugovoriRes, nekretnineRes, zakupniciRes] = await Promise.all([
        api.getPodsjetnici(),
        api.getUgovori(),
        api.getNekretnine(),
        api.getZakupnici()
      ]);
      setPodsjetnici(podsjedniciRes.data);
      setUgovori(ugovoriRes.data);
      setNekretnine(nekretnineRes.data);
      setZakupnici(zakupniciRes.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju podsjećanja:', error);
      toast.error('Greška pri učitavanju podsjećanja');
    } finally {
      setLoading(false);
    }
  };

  const getUgovorInfo = (ugovorId) => {
    const ugovor = ugovori.find(u => u.id === ugovorId);
    if (!ugovor) return null;

    const nekretnina = nekretnine.find(n => n.id === ugovor.nekretnina_id);
    const zakupnik = zakupnici.find(z => z.id === ugovor.zakupnik_id);

    return {
      ugovor,
      nekretnina,
      zakupnik
    };
  };

  const getPriorityBadge = (daniPrije) => {
    if (daniPrije <= 30) return <Badge variant="destructive">Visok prioritet</Badge>;
    if (daniPrije <= 60) return <Badge variant="secondary">Srednji prioritet</Badge>;
    return <Badge variant="outline">Nizak prioritet</Badge>;
  };

  const getTipLabel = (tip) => {
    const tipMap = {
      'istek_ugovora': 'Istek ugovora',
      'obnova_garancije': 'Obnova garancije',
      'indeksacija': 'Indeksacija'
    };
    return tipMap[tip] || tip;
  };

  if (loading) {
    return <div className="p-8">Učitava podsjećanja...</div>;
  }

  const aktivniPodsjetnici = podsjetnici.filter(p => !p.poslan);
  const poslaniPodsjetnici = podsjetnici.filter(p => p.poslan);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Podsjećanja</h1>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {aktivniPodsjetnici.length} aktivnih podsjećanja
        </Badge>
      </div>

      {aktivniPodsjetnici.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <Bell className="w-5 h-5 mr-2" />
              Aktivna podsjećanja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aktivniPodsjetnici.slice(0, 10).map((podsjetnik) => {
                const ugovorInfo = getUgovorInfo(podsjetnik.ugovor_id);
                if (!ugovorInfo) return null;

                return (
                  <div key={podsjetnik.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium">{getTipLabel(podsjetnik.tip)}</h4>
                        {getPriorityBadge(podsjetnik.dani_prije)}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Ugovor: {ugovorInfo.ugovor.interna_oznaka}
                      </p>
                      <p className="text-sm text-blue-600">
                        {ugovorInfo.nekretnina?.naziv} - {ugovorInfo.zakupnik?.naziv_firme || ugovorInfo.zakupnik?.ime_prezime}
                      </p>
                      <p className="text-sm text-gray-500">
                        Podsjetnik za: {new Date(podsjetnik.datum_podsjetnika).toLocaleDateString()} ({podsjetnik.dani_prije} dana prije)
                      </p>
                    </div>
                    <div className="text-right">
                      <Button variant="outline" size="sm">
                        Označi kao poslano
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statistika podsjećanja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Ukupno podsjećanja:</span>
                <span className="font-bold">{podsjetnici.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Aktivna:</span>
                <span className="font-bold text-orange-600">{aktivniPodsjetnici.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Poslana:</span>
                <span className="font-bold text-green-600">{poslaniPodsjetnici.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Visok prioritet (≤30 dana):</span>
                <span className="font-bold text-red-600">
                  {aktivniPodsjetnici.filter(p => p.dani_prije <= 30).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sljedeća podsjećanja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aktivniPodsjetnici
                .sort((a, b) => new Date(a.datum_podsjetnika) - new Date(b.datum_podsjetnika))
                .slice(0, 5)
                .map((podsjetnik) => {
                  const ugovorInfo = getUgovorInfo(podsjetnik.ugovor_id);
                  if (!ugovorInfo) return null;

                  return (
                    <div key={podsjetnik.id} className="border-l-4 border-blue-500 pl-3">
                      <p className="font-medium text-sm">{getTipLabel(podsjetnik.tip)}</p>
                      <p className="text-xs text-gray-600">{ugovorInfo.ugovor.interna_oznaka}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(podsjetnik.datum_podsjetnika).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nekretnine" element={<Nekretnine />} />
          <Route path="/zakupnici" element={<Zakupnici />} />
          <Route path="/ugovori" element={<Ugovori />} />
          <Route path="/dokumenti" element={<Dokumenti />} />
          <Route path="/podsjetnici" element={<Podsjetnici />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;