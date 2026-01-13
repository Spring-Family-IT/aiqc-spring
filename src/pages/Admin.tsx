import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdmin } from '@/hooks/useAdmin';
import { ArrowLeft, Shield, Users, Settings, Activity, Loader2 } from 'lucide-react';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, user } = useAdmin();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const adminCards = [
    {
      title: 'User Management',
      description: 'Manage users, roles, and send invitations',
      icon: Users,
      href: '/user-management',
      color: 'text-blue-500',
    },
    {
      title: 'System Diagnostics',
      description: 'Check system health and edge function status',
      icon: Activity,
      href: '/diagnostics',
      color: 'text-green-500',
    },
    {
      title: 'Settings',
      description: 'Configure application settings',
      icon: Settings,
      href: '#',
      color: 'text-gray-500',
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
          </div>
        </div>

        {/* Admin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminCards.map((card) => (
            <Card 
              key={card.title}
              className={`cursor-pointer transition-all hover:shadow-md ${card.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}`}
              onClick={() => !card.disabled && navigate(card.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <card.icon className={`h-8 w-8 ${card.color}`} />
                  <div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={card.disabled}
                >
                  {card.disabled ? 'Coming Soon' : 'Open'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
