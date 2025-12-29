
import React from 'react';
import { Greeting } from '../types';
import GreetingCard from './GreetingCard';

interface GreetingListProps {
  greetings: Greeting[];
  onDelete: (id: string) => void;
}

const GreetingList: React.FC<GreetingListProps> = ({ greetings, onDelete }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {greetings.map((greeting) => (
        <GreetingCard key={greeting.id} greeting={greeting} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default GreetingList;
